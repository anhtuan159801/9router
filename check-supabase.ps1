# check-supabase.ps1
# Kiem tra truoc trang thai Supabase sync
# LUU Y: Chay sau khi da set Supabase env trong Koyeb dashboard

$KoyebBin = Join-Path $env:LOCALAPPDATA "koyeb\bin\koyeb.exe"

Write-Host "========================================"
Write-Host "  KIEM TRA SUPABASE SYNC"
Write-Host "========================================"

# 1. Kiem tra table (can Supabase URL va key)
Write-Host ""
Write-Host "[1/3] Kiem tra table router_config_snapshots..."
$supabaseUrl = Read-Host "Supabase URL (https://xxx.supabase.co)"
$supabaseKey = Read-Host "Supabase Secret Key"
try {
    $tableCheck = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/router_config_snapshots" -Method GET -Headers @{
        "apikey" = $supabaseKey
        "Authorization" = "Bearer $supabaseKey"
        "Accept" = "application/json"
    }
    $rowCount = @($tableCheck).Count
    Write-Host "  OK: Table ton tai, co $rowCount snapshot(s)." -ForegroundColor Green
} catch {
    Write-Host "  LOI: Table chua duoc tao hoac khong co quyen." -ForegroundColor Red
    Write-Host "  Chay SQL trong setup-supabase-table.sql." -ForegroundColor Red
}

# 2. Kiem tra env
Write-Host ""
Write-Host "[2/3] Kiem tra Supabase env trong Koyeb..."
$serviceDesc = & $KoyebBin service describe 9router/bb272bb0 -o json 2>$null
$env = $serviceDesc.deployments[0].definition.env
$supabaseEnv = $env | Where-Object { $_.key -like "SUPABASE*" }
if ($supabaseEnv.Count -ge 4) {
    Write-Host "  OK: 4 Supabase env vars da duoc set." -ForegroundColor Green
} else {
    Write-Host "  LOI: Chua du env. Chay .\deploy-koyeb.ps1" -ForegroundColor Red
}

# 3. Kiem tra log
Write-Host ""
Write-Host "[3/3] Kiem tra log Koyeb..."
$logs = & $KoyebBin service logs 9router/bb272bb0 2>&1 | Select-Object -Last 50
$supabaseLogs = $logs | Select-String -Pattern "Supabase|sync" -CaseSensitive:$false
if ($supabaseLogs) {
    Write-Host "  Co log Supabase:"
    $supabaseLogs | Select-Object -Last 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "  Chua co log Supabase." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================"
Write-Host "  HUONG DAN"
Write-Host "========================================"
Write-Host "1. Nu table chua co: Chay SQL trong setup-supabase-table.sql"
Write-Host "2. Nu env chua du: Chay .\deploy-koyeb.ps1"
Write-Host "3. Restart service: koyeb service redeploy 9router/bb272bb0"
Write-Host ""
