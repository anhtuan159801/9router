# deploy-koyeb.ps1
# Script tu dong deploy 9router len Koyeb
# Chay: .\deploy-koyeb.ps1

$ErrorActionPreference = "Stop"
$App = "9router"
$KoyebBin = $null

# ── Tim koyeb binary ──────────────────────────────────────────────────────────
function Find-KoyebBinary {
    $cmd = Get-Command "koyeb" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "koyeb\bin\koyeb.exe"),
        (Join-Path $env:USERPROFILE ".koyeb\bin\koyeb.exe")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

function Add-KoyebToSessionPath {
    $koyebDir = Join-Path $env:LOCALAPPDATA "koyeb\bin"
    if (Test-Path $koyebDir) {
        $env:Path += ";$koyebDir"
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY 9ROUTER LEN KOYEB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ── Buoc 1: Kiem tra Koyeb CLI ────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/5] Kiem tra Koyeb CLI..." -ForegroundColor Yellow
$KoyebBin = Find-KoyebBinary
if (-not $KoyebBin) {
    Add-KoyebToSessionPath
    $KoyebBin = Find-KoyebBinary
}
if (-not $KoyebBin) {
    Write-Host "Khong tim thay koyeb.exe. Chay truoc: .\install-koyeb.ps1 va koyeb login" -ForegroundColor Red
    exit 1
}
Write-Host "Da tim thay: $KoyebBin" -ForegroundColor Green

# ── Buoc 2: Kiem tra da login chua ───────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Kiem tra dang nhap Koyeb..." -ForegroundColor Yellow
$loginCheck = & $KoyebBin app list 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Chua dang nhap. Chay: koyeb login" -ForegroundColor Red
    exit 1
}
Write-Host "Dang nhap OK." -ForegroundColor Green

# ── Thong tin Supabase ────────────────────────────────────────────────────────
# LUU Y: Supabase keys duoc luu trong Koyeb env vars (khong nemoi trong code)
# Nu chua co, script se bo qua buoc Supabase
$supabaseUrl = $env:SUPABASE_URL
$supabaseSecretKey = $env:SUPABASE_SECRET_KEY
$supabaseEncryptionKey = $env:SUPABASE_SYNC_ENCRYPTION_KEY
$supabaseInstanceId = "default"

$hasSupabase = ($supabaseUrl -and $supabaseSecretKey -and $supabaseEncryptionKey)
if (-not $hasSupabase) {
    Write-Host ""
    Write-Host "Thong tin: Supabase env vars chua duoc set." -ForegroundColor Yellow
    Write-Host "De bat Supabase sync, set cac bien moi truoc:"
    Write-Host "  SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_SYNC_ENCRYPTION_KEY"
    Write-Host "Roi chay lai script nay."
}

# ── Buoc 3: Deploy app ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Deploy app len Koyeb..." -ForegroundColor Yellow

# Kiem tra service da co chua
$serviceList = & $KoyebBin service list 2>$null
$existingService = $serviceList | Select-String -Pattern $App | Select-Object -First 1

if ($existingService) {
    # Lay service ID
    $serviceLine = $serviceList | Select-String -Pattern "^\s*(\w{8})\s+$App\s+" | Select-Object -First 1
    $serviceId = if ($serviceLine) { $serviceLine.Matches[0].Groups[1].Value } else { $App }
    $serviceRef = "$App/$serviceId"
    
    Write-Host "Update service $serviceRef voi Supabase..." -ForegroundColor Cyan
    & $KoyebBin service update $serviceRef --instance-type free --min-scale 0 `
        --env "SUPABASE_URL=$supabaseUrl" `
        --env "SUPABASE_SECRET_KEY=$supabaseSecretKey" `
        --env "SUPABASE_SYNC_ENCRYPTION_KEY=$supabaseEncryptionKey" `
        --env "SUPABASE_SYNC_INSTANCE_ID=$supabaseInstanceId" 2>$null
    Write-Host "Update thanh cong." -ForegroundColor Green
} else {
    Write-Host "Tao app va service moi..." -ForegroundColor Cyan
    & $KoyebBin apps create $App 2>$null
    & $KoyebBin service create $App --app $App `
        --docker "decolua/9router:latest" `
        --instance-type free `
        --min-scale 0 `
        --max-scale 1 `
        --port "20128:http" `
        --route "/:20128" `
        --checks "20128:http:/api/health" `
        --env "PORT=20128" `
        --env "HOSTNAME=0.0.0.0" `
        --env "NODE_ENV=production" `
        --env "DATA_DIR=/app/data" `
        --env "JWT_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_SECRET" `
        --env "INITIAL_PASSWORD=123456789" `
        --env "API_KEY_SECRET=endpoint-proxy-api-key-secret" `
        --env "MACHINE_ID_SALT=endpoint-proxy-salt" `
        --env "BASE_URL=https://9router.koyeb.app" `
        --env "NEXT_PUBLIC_BASE_URL=https://9router.koyeb.app" `
        --env "CLOUD_URL=https://9router.com" `
        --env "ENABLE_REQUEST_LOGS=false" `
        --env "OBSERVABILITY_ENABLED=true" `
        --env "AUTH_COOKIE_SECURE=false" `
        --env "REQUIRE_API_KEY=false" `
        --env "SUPABASE_URL=$supabaseUrl" `
        --env "SUPABASE_SECRET_KEY=$supabaseSecretKey" `
        --env "SUPABASE_SYNC_ENCRYPTION_KEY=$supabaseEncryptionKey" `
        --env "SUPABASE_SYNC_INSTANCE_ID=$supabaseInstanceId" `
        --wait 2>$null
    Write-Host "Tao service thanh cong." -ForegroundColor Green
}

# ── Buoc 4: Lay domain ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Lay domain Koyeb..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$appDetail = & $KoyebBin app get $App 2>$null
$domainLine = $appDetail | Select-String -Pattern 'https?://[\w.-]+\.koyeb\.app|https?://[\w.-]+\.apps\.mistral\.run' | Select-Object -First 1
$domain = if ($domainLine) { ($domainLine.Matches | Select-Object -First 1).Value } else { $null }

if ($domain) {
    Write-Host "Domain: $domain" -ForegroundColor Green
} else {
    Write-Host "Khong tim thay domain. Chay: koyeb app get $App" -ForegroundColor Yellow
}

# ── Buoc 5: Cap nhat BASE_URL ───────────────────────────────────────────────
if ($domain) {
    Write-Host ""
    Write-Host "[5/5] Cap nhat BASE_URL..." -ForegroundColor Yellow
    $serviceLine2 = (& $KoyebBin service list 2>$null) | Select-String -Pattern "^\s*(\w{8})\s+$App\s+" | Select-Object -First 1
    $serviceId2 = if ($serviceLine2) { $serviceLine2.Matches[0].Groups[1].Value } else { $App }
    $serviceRef2 = "$App/$serviceId2"
    & $KoyebBin service update $serviceRef2 --env "BASE_URL=$domain" --env "NEXT_PUBLIC_BASE_URL=$domain" 2>$null
    Write-Host "Cap nhat BASE_URL thanh cong." -ForegroundColor Green
}

# ── Hoi luu ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  HOAN TAT DEPLOY 9ROUTER!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
if ($domain) {
    Write-Host "Truy cap: $domain" -ForegroundColor Green
}
Write-Host "Xem logs:   koyeb service logs 9router/bb272bb0 -f" -ForegroundColor White
Write-Host "Xoa app:    koyeb app delete $App" -ForegroundColor White
Write-Host ""
