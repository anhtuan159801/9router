# install-koyeb.ps1
# Tu dong tai va cai Koyeb CLI cho Windows
# Chay bang PowerShell: .\install-koyeb.ps1

$ErrorActionPreference = "Stop"

$repo = "koyeb/koyeb-cli"
$installDir = Join-Path $env:LOCALAPPDATA "koyeb"
$binDir = Join-Path $installDir "bin"
$exeName = "koyeb.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CAI DAT KOYEB CLI CHO WINDOWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Tao thu muc cai dat
if (!(Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    Write-Host "Da tao thu muc: $binDir" -ForegroundColor Green
}

# 2. Lay thong tin release moi nhat tu GitHub API
Write-Host "Dang kiem tra phien ban moi nhat tren GitHub..." -ForegroundColor Yellow
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -TimeoutSec 30
    $tagName = $release.tag_name
    Write-Host "Phien ban moi nhat: $tagName" -ForegroundColor Green
}
catch {
    Write-Warning "Khong the goi GitHub API. Su dung URL du phong."
    $tagName = "latest"
}

# 3. Tim asset thuong Windows
$asset = $null
if ($release) {
    foreach ($a in $release.assets) {
        $name = $a.name
        if ($name -like "*windows*" -and ($name -like "*.exe" -or $name -like "*.zip")) {
            $asset = $a
            break
        }
    }
}

if (-not $asset) {
    Write-Error "Khong tim thay asset Windows trong release latest. Vui long tai thu cong tai: https://github.com/$repo/releases"
    exit 1
}

Write-Host "Dang tai: $($asset.name)" -ForegroundColor Yellow
$tempFile = Join-Path $env:TEMP "koyeb-cli-download.$($asset.name.Split('.')[-1])"

try {
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tempFile -TimeoutSec 120
    Write-Host "Tai thanh cong: $tempFile" -ForegroundColor Green
}
catch {
    Write-Error "Tai that bai: $_"
    exit 1
}

# 4. Giai nen / chuan bi binary
$destExe = Join-Path $binDir $exeName

if ($tempFile -like "*.zip") {
    Write-Host "Dang giai nen..." -ForegroundColor Yellow
    Expand-Archive -Path $tempFile -DestinationPath $binDir -Force
    $foundExe = Get-ChildItem -Path $binDir -Filter "*.exe" -Recurse | Select-Object -First 1
    if ($foundExe) {
        Move-Item -Path $foundExe.FullName -Destination $destExe -Force
        Get-ChildItem -Path $binDir -Exclude $exeName -Recurse | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    else {
        Write-Error "Khong tim thay file .exe sau khi giai nen."
        exit 1
    }
}
else {
    Move-Item -Path $tempFile -Destination $destExe -Force
}

# 5. Kiem tra binary
if (!(Test-Path $destExe)) {
    Write-Error "Cai dat that bai: khong tim thay $destExe"
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CAI DAT THANH CONG!" -ForegroundColor Green
Write-Host "Binary: $destExe" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "BUOC TIEP THEO (quan trong):" -ForegroundColor Yellow
Write-Host "1. Them thu muc sau vao PATH cua Windows:" -ForegroundColor White
Write-Host "   $binDir" -ForegroundColor White
Write-Host ""
Write-Host "   Cach nhanh (chay PowerShell qua Administrator):" -ForegroundColor White
$cmd = '[System.Environment]::SetEnvironmentVariable("Path", [System.Environment]::GetEnvironmentVariable("Path", "User") + "' + $binDir + '", "User")'
Write-Host "   $cmd" -ForegroundColor White
Write-Host ""
Write-Host "2. Khoi dong lai PowerShell/CMD sau khi them PATH."
Write-Host ""
Write-Host "3. Kiem tra cai dat:" -ForegroundColor White
Write-Host "   koyeb --version" -ForegroundColor White
Write-Host ""
Write-Host "4. Dang nhap Koyeb:" -ForegroundColor White
Write-Host "   koyeb login" -ForegroundColor White
Write-Host ""
Write-Host "5. Deploy 9router (tu thu muc C:\AnhTuan\Tool\9router):" -ForegroundColor White
Write-Host "   koyeb app create --filename koyeb.yaml" -ForegroundColor White
Write-Host ""
