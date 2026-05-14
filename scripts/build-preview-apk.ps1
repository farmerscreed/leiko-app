# scripts/build-preview-apk.ps1
#
# Sprint 16.6 — Pre-Launch Validation & Hardening, deliverable A.2.
#
# Builds a release APK with the dev machine's LAN Supabase URL +
# anon key baked into the JS bundle, so the install can run free
# on Wi-Fi after the cable comes out. The APK is the same on both
# phones; install once via this script (auto-installs over USB),
# then `adb install -r <apk>` the same file on the second phone.
#
# Default mode is `expo-run`, which calls `npx expo run:android
# --variant release` from apps/mobile. That path is fast on Windows
# and avoids EAS's Docker dependency. Use `-Mode eas-local` if you
# want the `eas build --profile preview-lan --local` flow instead.
#
# Usage (Windows PowerShell 5.1 or PowerShell 7 — script is dual-compatible):
#   powershell -File scripts\build-preview-apk.ps1
#   powershell -File scripts\build-preview-apk.ps1 -Mode eas-local
#   powershell -File scripts\build-preview-apk.ps1 -LanIp 192.168.0.166
# Or from an already-open PowerShell session:
#   .\scripts\build-preview-apk.ps1
#
# Exits 0 on success, non-zero on any pre-flight check failure.

[CmdletBinding()]
param(
    [ValidateSet('expo-run', 'eas-local')]
    [string]$Mode = 'expo-run',

    # Override the auto-detected LAN IP. Useful if the script
    # picks the wrong adapter (multi-NIC machines).
    [string]$LanIp
)

$ErrorActionPreference = 'Stop'

function Write-Status($label, $ok, $detail = '') {
    $marker = if ($ok) { '[OK] ' } else { '[!! ]' }
    Write-Host "$marker $label" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
    if ($detail) { Write-Host "       $detail" -ForegroundColor DarkGray }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot 'apps\mobile'

# ------------------------------------------------------------------
# 1. Detect LAN IPv4 (or use override).
# ------------------------------------------------------------------
if (-not $LanIp) {
    $candidates = Get-NetIPConfiguration |
        Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' }
    if ($candidates.Count -eq 0) {
        Write-Status 'Detect LAN IPv4' $false 'No active adapter with a default gateway. Connect to Wi-Fi and retry.'
        exit 1
    }
    $primary = $candidates | Select-Object -First 1
    $LanIp = $primary.IPv4Address.IPAddress
    $adapter = $primary.InterfaceAlias
    Write-Status 'Detect LAN IPv4' $true "$LanIp on $adapter"
    if ($candidates.Count -gt 1) {
        Write-Host '       Multiple adapters found; verify this is the Wi-Fi the phones will use.' -ForegroundColor Yellow
        Write-Host "       Override with: -LanIp <ip>" -ForegroundColor DarkGray
    }
} else {
    Write-Status 'Detect LAN IPv4' $true "$LanIp (override)"
}

# ------------------------------------------------------------------
# 2. Read dev Supabase publishable/anon key from `supabase status`.
# ------------------------------------------------------------------
try {
    # Route through cmd.exe so its `2>nul` consumes the supabase
    # CLI's stderr (e.g. the harmless "Stopped services" notice for
    # imgproxy/pooler) before PowerShell sees it. Without this,
    # PS 5.1's native-command stderr handler turns the notice into
    # a NativeCommandError that $ErrorActionPreference='Stop' treats
    # as fatal — even though the JSON stdout is perfectly fine.
    $rawJson = (cmd /c "supabase status --output json 2>nul") -join "`n"
    if (-not $rawJson) { throw 'supabase status returned no output' }
    $status = $rawJson | ConvertFrom-Json
} catch {
    Write-Status 'Read supabase status' $false "Run ``supabase start`` from the repo root, then retry. ($($_.Exception.Message))"
    exit 1
}

# CLI 2.98+ prints PUBLISHABLE_KEY (sb_publishable_*); older versions
# print only ANON_KEY (legacy JWT). supabase-js 2.105+ accepts both.
$anonKey = if ($status.PUBLISHABLE_KEY) { $status.PUBLISHABLE_KEY } else { $status.ANON_KEY }
if (-not $anonKey) {
    Write-Status 'Read supabase status' $false 'Neither PUBLISHABLE_KEY nor ANON_KEY present in supabase status JSON.'
    exit 1
}
$keyPreview = if ($anonKey.Length -gt 12) { $anonKey.Substring(0, 8) + '...' } else { '(short)' }
Write-Status 'Read supabase status' $true "key: $keyPreview"

# ------------------------------------------------------------------
# 3. Firewall sanity (skip if all profiles are Disabled).
# ------------------------------------------------------------------
$activeProfiles = Get-NetFirewallProfile | Where-Object { $_.Enabled -eq 'True' }
if ($activeProfiles.Count -eq 0) {
    Write-Status 'Windows Firewall' $true 'Disabled on all profiles; no rule needed.'
} else {
    # Look for any inbound allow rule covering 54321 or 54324.
    $needPorts = @(54321, 54324)
    $allowed = @{}
    Get-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -ErrorAction SilentlyContinue |
        ForEach-Object {
            $portFilter = $_ | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue
            foreach ($p in $needPorts) {
                if ($portFilter.LocalPort -contains $p.ToString() -or $portFilter.LocalPort -contains 'Any') {
                    $allowed[$p] = $true
                }
            }
        }
    $missing = $needPorts | Where-Object { -not $allowed.ContainsKey($_) }
    if ($missing.Count -eq 0) {
        Write-Status 'Windows Firewall' $true '54321 + 54324 already permitted.'
    } else {
        Write-Status 'Windows Firewall' $false "Inbound block on port(s): $($missing -join ', ')"
        Write-Host '       Open a PowerShell as Administrator and run:' -ForegroundColor Yellow
        foreach ($p in $missing) {
            Write-Host "       New-NetFirewallRule -DisplayName 'Leiko Dev $p' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p" -ForegroundColor DarkGray
        }
        exit 1
    }
}

# ------------------------------------------------------------------
# 4. Phone connected? (skipped in eas-local mode — EAS doesn't auto-install)
# ------------------------------------------------------------------
$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
$adb = if ($adbCmd) { $adbCmd.Source } else { 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' }
if (-not (Test-Path $adb)) {
    Write-Status 'Locate adb' $false 'adb not on PATH and not at the default Android SDK location.'
    exit 1
}
if ($Mode -eq 'expo-run') {
    $devices = & $adb devices | Select-String -Pattern '\sdevice$'
    if ($devices.Count -lt 1) {
        Write-Status 'Phone connected via USB' $false 'Plug a phone in, approve the prompt, then retry.'
        exit 1
    }
    Write-Status 'Phone connected via USB' $true ($devices | Select-Object -First 1).Line.Trim()
}

# ------------------------------------------------------------------
# 5. Export env vars for the build process.
# ------------------------------------------------------------------
$env:EXPO_PUBLIC_SUPABASE_URL = "http://${LanIp}:54321"
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = $anonKey
$env:EXPO_PUBLIC_BUILD_PROFILE = 'preview-lan'

Write-Host ''
Write-Host '--- Build env ---' -ForegroundColor Cyan
Write-Host "  EXPO_PUBLIC_SUPABASE_URL      = $env:EXPO_PUBLIC_SUPABASE_URL"
Write-Host "  EXPO_PUBLIC_SUPABASE_ANON_KEY = $keyPreview"
Write-Host "  EXPO_PUBLIC_BUILD_PROFILE     = $env:EXPO_PUBLIC_BUILD_PROFILE"
Write-Host ''

# ------------------------------------------------------------------
# 6. Build.
# ------------------------------------------------------------------
Push-Location $mobileDir
try {
    if ($Mode -eq 'expo-run') {
        # Pass $mobileDir as the positional project-root so Expo CLI
        # doesn't walk up to the workspace root (where node_modules/expo
        # is hoisted) and pick that as the project root. Documented
        # symptom of the workspace heuristic: Metro fails to resolve
        # `./index.js` because it thinks the entry lives at the repo root.
        Write-Host ">>> npx expo run:android `"$mobileDir`" --variant release" -ForegroundColor Cyan
        & npx expo run:android $mobileDir --variant release
        $code = $LASTEXITCODE
    } else {
        Write-Host '>>> eas build --platform android --profile preview-lan --local' -ForegroundColor Cyan
        & npx eas build --platform android --profile preview-lan --local --non-interactive
        $code = $LASTEXITCODE
    }
} finally {
    Pop-Location
}

if ($code -ne 0) {
    Write-Status 'Build' $false "Build exited with code $code."
    exit $code
}

# ------------------------------------------------------------------
# 7. Locate APK + print post-build hint.
# ------------------------------------------------------------------
$apkSearchRoot = if ($Mode -eq 'expo-run') {
    Join-Path $mobileDir 'android\app\build\outputs\apk\release'
} else {
    $mobileDir
}
$apk = $null
if (Test-Path $apkSearchRoot) {
    $apk = Get-ChildItem -Path $apkSearchRoot -Filter '*.apk' -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

Write-Host ''
if ($apk) {
    Write-Status 'APK ready' $true $apk.FullName
    Write-Host ''
    Write-Host 'Next:' -ForegroundColor Cyan
    Write-Host '  1. (already done if -Mode expo-run) installed on the connected phone.' -ForegroundColor DarkGray
    Write-Host '  2. For the second phone, plug it in and run:' -ForegroundColor DarkGray
    Write-Host "       $adb install -r `"$($apk.FullName)`"" -ForegroundColor DarkGray
    Write-Host '  3. Unplug. Both phones on the same Wi-Fi as the dev PC.' -ForegroundColor DarkGray
    Write-Host "  4. Open Leiko. It will reach Supabase at $env:EXPO_PUBLIC_SUPABASE_URL." -ForegroundColor DarkGray
    Write-Host '  5. If the app says "Network request failed", confirm the phone' -ForegroundColor DarkGray
    Write-Host "     can open $env:EXPO_PUBLIC_SUPABASE_URL/ in Chrome." -ForegroundColor DarkGray
} else {
    Write-Status 'Locate APK' $false "Build succeeded but no .apk found under $apkSearchRoot."
    exit 1
}
