param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$configPath = 'C:\Program Files\MongoDB\Server\9.0\bin\mongod.cfg'
$contents = Get-Content -LiteralPath $configPath -Raw
if ($contents -notmatch '(?m)^\s*port:\s*27017\s*$' -or $contents -notmatch '(?m)^\s*bindIp:\s*127\.0\.0\.1\s*$') {
    throw 'The local MongoDB config differs from the reviewed localhost:27017 setup. No changes made.'
}
if ($contents -match '(?m)^replication:') {
    if ($contents -notmatch '(?m)^\s*replSetName:\s*rs0\s*$') { throw 'An existing replication config needs manual review. No changes made.' }
}
if (-not $Apply) {
    Write-Output 'Ready: back up mongod.cfg, enable single-node rs0, restart MongoDB, and initialize rs0. Existing dbPath and bindIp are preserved.'
    Write-Output 'Apply from an Administrator PowerShell: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/enable-local-replica-set.ps1 -Apply'
    exit 0
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Administrator PowerShell is required to restart MongoDB. No changes made.' }
$service = Get-Service -Name MongoDB
if ($service.Status -ne 'Running') { throw 'MongoDB is not running. No changes made.' }
$backupPath = $configPath + '.before-repair-transactions-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Copy-Item -LiteralPath $configPath -Destination $backupPath
try {
    if ($contents -notmatch '(?m)^replication:') {
        Add-Content -LiteralPath $configPath -Value "`r`nreplication:`r`n  replSetName: rs0`r`n"
    }
    Restart-Service -Name MongoDB
    & node (Join-Path $PSScriptRoot 'init-local-replica.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Replica-set initialization failed.' }
    Write-Output ('Backup saved: ' + $backupPath)
} catch {
    Copy-Item -LiteralPath $backupPath -Destination $configPath -Force
    Restart-Service -Name MongoDB
    throw
}
