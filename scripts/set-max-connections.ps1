<#
PowerShell script to set MariaDB/MySQL max_connections using mysql client.
Usage: run from a PowerShell prompt after loading env variables (e.g. `Set-Content -Path .env -Value (Get-Content .env.example)` then `Get-Content .env | ForEach-Object { $parts = $_ -split '='; if ($parts.Count -eq 2) { Set-Item -Path env:$($parts[0]) -Value $parts[1] } }`).
#>

param(
  [string]$Host = $env:DB_HOST,
  [string]$Port = $env:DB_PORT,
  [string]$User = $env:DB_ADMIN_USER,
  [string]$Pass = $env:DB_ADMIN_PASSWORD,
  [int]$Max = [int]($env:DB_MAX_CONNECTIONS)
)

if (-not $User -or -not $Pass -or -not $Host -or -not $Port -or -not $Max) {
  Write-Error "Missing required env var. Please ensure DB_ADMIN_USER, DB_ADMIN_PASSWORD, DB_HOST, DB_PORT and DB_MAX_CONNECTIONS are set."
  exit 2
}

$cmd = "SET GLOBAL max_connections = $Max;"
Write-Host "Applying: $cmd to $Host:$Port as $User"

# Execute using mysql client. Ensure mysql client is in PATH.
$escapedPass = $Pass -replace '"','\"'
$mysqlCmd = "mysql -h $Host -P $Port -u $User -p`"$escapedPass`" -e `"$cmd`""

try {
  Write-Host "Running: $mysqlCmd"
  iex $mysqlCmd
  Write-Host "Succeeded."
} catch {
  Write-Error "Failed to apply max_connections: $_"
  exit 1
}
