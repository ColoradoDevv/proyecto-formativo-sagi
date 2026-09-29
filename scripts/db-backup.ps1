#Requires -Version 5.1
<#
.SYNOPSIS
  Backup Postgres SAGI (staging/prod) con pg_dump. No imprime secretos.
.EXAMPLE
  .\scripts\db-backup.ps1 -Env staging
#>
param(
  [ValidateSet("staging", "prod")]
  [string]$Env = "staging"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Error "No existe backend\.env (copia backend\.env.$Env.example primero)."
}

# Lee backend/.env sin ejecutarlo ni mostrar valores.
$vars = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $i = $line.IndexOf("=")
  if ($i -lt 1) { return }
  $vars[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1).Trim()
}

foreach ($k in @("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_PORT")) {
  if ([string]::IsNullOrWhiteSpace($vars[$k])) { Write-Error "Falta $k en backend\.env." }
}
if ($vars["DB_PORT"] -eq "6543") {
  Write-Warning "Usas pooler (6543): pg_dump requiere conexion DIRECTA (5432). Cambia DB_HOST/DB_PORT temporalmente."
}
if ([string]::IsNullOrWhiteSpace($vars["DB_HOST"]) -or $vars["DB_HOST"] -like "*pooler*") {
  Write-Warning "DB_HOST parece pooler. Para dumps usa db.xxxxx.supabase.co (ver .env.$Env.example)."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$outDir = Join-Path $root "backups"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$out = Join-Path $outDir "sagi-$Env-$stamp.dump"

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) { Write-Error "pg_dump no encontrado. Instala PostgreSQL Client Tools." }

$env:PGPASSWORD = $vars["DB_PASSWORD"]
try {
  & pg_dump -h $vars["DB_HOST"] -p $vars["DB_PORT"] -U $vars["DB_USER"] -d $vars["DB_NAME"] -F c -f $out
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

$size = (Get-Item -LiteralPath $out).Length
if ($size -lt 1024) { Write-Error "Backup sospechoso ($size bytes): $out. No continuar con migrate." }
Write-Output "OK backup $Env -> $out ($size bytes)"
