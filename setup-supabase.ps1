# setup-supabase.ps1
# Them Supabase sync vao 9router Koyeb
# LUU Y: Supabase keys khong duoc cam trong code (GitHub secret scanning)
# Chay: .\setup-supabase.ps1

$ErrorActionPreference = "Stop"
$App = "9router"
$ServiceId = "bb272bb0"
$KoyebBin = $null

# Tim koyeb binary
$cmd = Get-Command "koyeb" -ErrorAction SilentlyContinue
if ($cmd) { $KoyebBin = $cmd.Source }
else {
    $KoyebBin = Join-Path $env:LOCALAPPDATA "koyeb\bin\koyeb.exe"
    if (!(Test-Path $KoyebBin)) {
        Write-Host "Khong tim thay koyeb.exe. Chay truoc: .\install-koyeb.ps1 va koyeb login" -ForegroundColor Red
        exit 1
    }
}

# Doc Supabase keys tu env vars (set truoc khi chay script)
$supabaseUrl = $env:SUPABASE_URL
$supabaseSecretKey = $env:SUPABASE_SECRET_KEY
$supabaseEncryptionKey = $env:SUPABASE_SYNC_ENCRYPTION_KEY

if (-not $supabaseUrl -or -not $supabaseSecretKey -or -not $supabaseEncryptionKey) {
    Write-Host "Can phai set 3 env vars truoc:" -ForegroundColor Yellow
    Write-Host "  SUPABASE_URL"
    Write-Host "  SUPABASE_SECRET_KEY"
    Write-Host "  SUPABASE_SYNC_ENCRYPTION_KEY"
    Write-Host ""
    Write-Host "Vidu (chay trong PowerShell):"
    Write-Host "  ``$env:SUPABASE_URL='https://xxx.supabase.co'"
    Write-Host "  ``$env:SUPABASE_SECRET_KEY='sb_secret_...'"
    Write-Host "  ``$env:SUPABASE_SYNC_ENCRYPTION_KEY='base64-key='  (32 byte)"
    Write-Host ""
    Write-Host "Hoac luu vao file .env va import:"
    Write-Host "  Import-Csv -Path .env | ForEach-Object { Set-Item -Path ``\"env:`$_ -Name ``$_.key -Value ``$_.value"
    exit 1
}

Write-Host "Cap nhat $App/$ServiceId voi Supabase sync..." -ForegroundColor Cyan
& $KoyebBin service update $App/$ServiceId `
    --env "SUPABASE_URL=$supabaseUrl" `
    --env "SUPABASE_SECRET_KEY=$supabaseSecretKey" `
    --env "SUPABASE_SYNC_ENCRYPTION_KEY=$supabaseEncryptionKey" `
    --env "SUPABASE_SYNC_INSTANCE_ID=default" 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "Thanh cong! Redeploy de apply:" -ForegroundColor Green
    Write-Host "  koyeb service redeploy $App/$ServiceId" -ForegroundColor White
} else {
    Write-Host "That bai. Kyem tra log Koyeb." -ForegroundColor Red
}
