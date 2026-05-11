# scripts/dev-phone-reconnect.ps1
#
# Run this whenever the dev phone disconnects + reconnects and the
# app shows "unable to load script" or any Edge Function fails
# silently. The root cause is always the same: `adb reverse`
# forwards clear on every USB disconnect, and Metro (8081) +
# Supabase (54321) both need them re-established before the phone
# can reach the dev machine.
#
# Usage (from any shell):
#   pwsh -File scripts/dev-phone-reconnect.ps1
#   ./scripts/dev-phone-reconnect.ps1     # if pwsh is in PATH
#
# Exits 0 on success, non-zero on any check failure so the user
# sees clearly which piece is broken.

$ErrorActionPreference = 'Stop'

function Write-Status($label, $ok, $detail = '') {
    $marker = if ($ok) { '[OK] ' } else { '[!! ]' }
    Write-Host "$marker $label" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
    if ($detail) { Write-Host "       $detail" -ForegroundColor DarkGray }
}

# 1. Phone connected?
$devices = & adb devices 2>&1 | Select-String -Pattern '\sdevice$'
$phoneOk = $devices.Count -ge 1
Write-Status 'Phone connected via USB' $phoneOk $(if ($phoneOk) { ($devices | Select-Object -First 1).Line.Trim() } else { 'Plug the cable back in, then re-run.' })
if (-not $phoneOk) { exit 1 }

# 2. Metro on 8081?
try {
    $metro = Invoke-WebRequest -Uri 'http://localhost:8081/status' -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    $metroOk = $metro.StatusCode -eq 200
} catch { $metroOk = $false }
Write-Status 'Metro dev server on :8081' $metroOk $(if (-not $metroOk) { 'Run `cd apps/mobile; npx expo start` in another terminal.' })

# 3. Supabase on 54321?
try {
    $supa = Invoke-WebRequest -Uri 'http://localhost:54321/' -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
    $supaOk = $true   # any HTTP response means Kong is up
} catch {
    # Kong returns 404 for /; that throws as a non-success status,
    # but we caught the response. Treat any HTTP reply as alive.
    if ($_.Exception.Response) {
        $supaOk = $true
    } else {
        $supaOk = $false
    }
}
Write-Status 'Supabase local on :54321' $supaOk $(if (-not $supaOk) { 'Run `supabase start` in another terminal.' })

# 3b. Edge Functions runtime alive? When `supabase functions serve`
# dies mid-session, Kong returns 503 "name resolution failed" and
# every AI surface times out with "I couldn't reach Leiko". Detect
# the dead-runtime state separately from Kong-up state so the founder
# knows to restart `supabase functions serve`.
$efOk = $false
try {
    $ef = Invoke-WebRequest -Uri 'http://localhost:54321/functions/v1/ai-tier-b' `
        -Method Options -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    $efOk = $ef.StatusCode -eq 200
} catch { $efOk = $false }
Write-Status 'Edge Functions runtime' $efOk $(if (-not $efOk) { 'Run `supabase functions serve --env-file supabase/functions/.env` in another terminal.' })

# 4. adb reverse forwards.
& adb reverse tcp:8081 tcp:8081 | Out-Null
& adb reverse tcp:54321 tcp:54321 | Out-Null
$reverse = & adb reverse --list 2>&1
$has8081 = ($reverse | Select-String -Pattern 'tcp:8081').Count -ge 1
$has54321 = ($reverse | Select-String -Pattern 'tcp:54321').Count -ge 1
Write-Status 'adb reverse tcp:8081 (Metro)' $has8081
Write-Status 'adb reverse tcp:54321 (Supabase)' $has54321

if (-not ($phoneOk -and $metroOk -and $supaOk -and $efOk -and $has8081 -and $has54321)) {
    Write-Host ''
    Write-Host 'Fix the [!!] items above, then re-run this script.' -ForegroundColor Yellow
    exit 1
}

Write-Host ''
Write-Host 'All set. Reload the app on the phone (shake -> Reload, or R+R).' -ForegroundColor Green
