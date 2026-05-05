# Kena local toolchain installer.
#
# Two-pass installer — winget portion needs an elevated shell, Scoop portion
# refuses to run elevated. The script detects the current elevation level and
# does the right thing automatically.
#
# Usage:
#   1. ELEVATED PowerShell (Right-click > Run as Administrator):
#        scripts\install-toolchain.ps1
#      Installs Node.js LTS (24.x) + GitHub CLI via winget.
#   2. CLOSE the elevated window. Open a NEW non-elevated PowerShell:
#        scripts\install-toolchain.ps1
#      Bootstraps Scoop + installs Supabase CLI in user scope.
#   3. Run: scripts\verify-toolchain.ps1
#   4. Configure git (one-time):
#        git config --global user.name  "Your Name"
#        git config --global user.email "biebele@gmail.com"
#   5. Open a Claude Code session in this directory and say "continue Sprint 0".
#
# Docker Desktop is assumed already installed; this script does not touch it.

#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host "Kena toolchain installer" -ForegroundColor Cyan
Write-Host ("  Mode: {0}" -f ($(if ($isAdmin) { 'ELEVATED (winget pass)' } else { 'NON-ELEVATED (Scoop pass)' })))
Write-Host ""

function Install-IfMissing-Winget {
    param(
        [Parameter(Mandatory)] [string]$Command,
        [Parameter(Mandatory)] [string]$WingetId,
        [Parameter(Mandatory)] [string]$Label
    )
    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        Write-Host ("OK   {0,-15} already installed" -f $Label) -ForegroundColor Yellow
    } else {
        Write-Host ("..   Installing {0}" -f $Label) -ForegroundColor Green
        winget install -e --id $WingetId --accept-source-agreements --accept-package-agreements
    }
}

if ($isAdmin) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host "winget not found. Install 'App Installer' from the Microsoft Store first." -ForegroundColor Red
        exit 1
    }

    Install-IfMissing-Winget -Command 'node' -WingetId 'OpenJS.NodeJS.LTS' -Label 'Node.js LTS'
    Install-IfMissing-Winget -Command 'gh'   -WingetId 'GitHub.cli'        -Label 'GitHub CLI'

    Write-Host ""
    Write-Host "Elevated pass complete." -ForegroundColor Cyan
    Write-Host "Next: CLOSE this window, open a NEW non-elevated PowerShell, and re-run this script to install Supabase CLI via Scoop." -ForegroundColor Yellow
} else {
    # Non-elevated pass: Scoop + Supabase CLI.
    # `Supabase.CLI` is NOT a real winget id; Scoop is Supabase's officially
    # supported Windows install path. See ADR-0001 / Sprint 0b notes.

    if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
        Write-Host "..   Bootstrapping Scoop (user scope)" -ForegroundColor Green
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
    } else {
        Write-Host "OK   Scoop            already installed" -ForegroundColor Yellow
    }

    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        Write-Host "OK   Supabase CLI     already installed" -ForegroundColor Yellow
    } else {
        Write-Host "..   Installing Supabase CLI via Scoop" -ForegroundColor Green
        scoop bucket add supabase https://github.com/supabase/scoop-bucket.git 2>$null
        scoop install supabase/supabase
    }

    # Sanity check: warn if winget pass was skipped.
    foreach ($pair in @(@{cmd='node';label='Node.js'}, @{cmd='gh';label='GitHub CLI'})) {
        if (-not (Get-Command $pair.cmd -ErrorAction SilentlyContinue)) {
            Write-Host ("--   {0} missing — re-run this script from an ELEVATED PowerShell first." -f $pair.label) -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "Done." -ForegroundColor Cyan
    Write-Host "Next: scripts\verify-toolchain.ps1"
}
