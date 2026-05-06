# Leiko toolchain verifier.
# Run from a NEW PowerShell window after install-toolchain.ps1.
# Confirms every required CLI is on PATH and reports versions.

#Requires -Version 5.1

function Show-Version {
    param([string]$Name, [string]$Cmd)
    if (Get-Command $Cmd -ErrorAction SilentlyContinue) {
        $v = & $Cmd --version 2>$null | Select-Object -First 1
        Write-Host ("  OK   {0,-12} {1}" -f $Name, $v) -ForegroundColor Green
    } else {
        Write-Host ("  --   {0,-12} not found" -f $Name) -ForegroundColor Red
    }
}

Write-Host "Leiko toolchain verification" -ForegroundColor Cyan
Write-Host ""
Show-Version 'Node.js'    'node'
Show-Version 'npm'        'npm'
Show-Version 'Supabase'   'supabase'
Show-Version 'GitHub CLI' 'gh'
Show-Version 'Docker'     'docker'
Show-Version 'Git'        'git'

Write-Host ""
Write-Host "Git author config:" -ForegroundColor Cyan
$gitName  = git config --global user.name
$gitEmail = git config --global user.email
if ($gitName -and $gitEmail) {
    Write-Host "  OK   git user.name  = $gitName"
    Write-Host "  OK   git user.email = $gitEmail"
} else {
    Write-Host "  --   git author not set. Run:" -ForegroundColor Yellow
    Write-Host '       git config --global user.name  "Your Name"'
    Write-Host '       git config --global user.email "biebele@gmail.com"'
}

Write-Host ""
Write-Host "Docker daemon:" -ForegroundColor Cyan
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker info --format '{{.ServerVersion}}' 2>$null | ForEach-Object {
        if ($_) {
            Write-Host "  OK   docker daemon up (server $_)"
        } else {
            Write-Host "  --   docker daemon not responding (Docker Desktop not started yet?)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Next: open a Claude Code session in this directory and say 'continue Sprint 0'." -ForegroundColor Cyan
