# Daily MySQL backup (Windows Task Scheduler).
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
# Requires mysqldump in PATH.

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $val = $matches[2].Trim().Trim('"')
      [Environment]::SetEnvironmentVariable($name, $val, "Process")
    }
  }
}

$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "127.0.0.1" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "root" }
$dbPass = $env:DB_PASS
$dbName = $env:DB_NAME
if (-not $dbName) { throw "DB_NAME missing in .env" }

$backupRoot = Join-Path $PSScriptRoot "..\backups\mysql"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$plain = Join-Path $backupRoot "$dbName`_$stamp.sql"

if ($dbPass) {
  $env:MYSQL_PWD = $dbPass
}

$margs = @(
  "-h$dbHost",
  "-u$dbUser",
  "--single-transaction",
  "--routines",
  "--triggers",
  "--result-file=$plain",
  $dbName
)

& mysqldump @margs
if ($LASTEXITCODE -ne 0) { throw "mysqldump failed" }

Write-Host "Backup written: $plain"
