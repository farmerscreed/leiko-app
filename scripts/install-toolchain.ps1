# Kena local toolchain installer.
# Run ONCE after Windows restart, from an ELEVATED PowerShell (Right-click > Run as Administrator).
#
# Installs: Node.js LTS (22.x), Supabase CLI, GitHub CLI.
# Docker Desktop is assumed already installed; this script does not touch it.
#
# After this script finishes:
#   1. CLOSE this PowerShell window.
#   2. Open a NEW PowerShell window (does not need to be elevated).
#   3. Run: scripts\verify-toolchain.ps1
#   4. Configure git (one-time):
#        git config --global user.name  "Your Name"
#        git config --global user.email "biebele@gmail.com"
#   5. Open a new Claude Code session in this directory and say "continue Sprint 0".

#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

Write-Host "Kena toolchain installer" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "winget not found. Install 'App Installer' from the Microsoft Store first." -ForegroundColor Red
    exit 1
}

function Install-IfMissing {
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

Install-IfMissing -Command 'node'     -WingetId 'OpenJS.NodeJS.LTS' -Label 'Node.js LTS'
Install-IfMissing -Command 'supabase' -WingetId 'Supabase.CLI'      -Label 'Supabase CLI'
Install-IfMissing -Command 'gh'       -WingetId 'GitHub.cli'        -Label 'GitHub CLI'

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
Write-Host "Close this PowerShell window, open a new one, then run: scripts\verify-toolchain.ps1"
