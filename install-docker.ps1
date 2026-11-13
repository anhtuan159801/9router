# install-docker.ps1
# Tai va cai Docker Desktop cho Windows
# Chay: .\install-docker.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CAI DAT DOCKER DESKTOP CHO WINDOWS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Kiem tra da cai chua
if (Get-Command "docker" -ErrorAction SilentlyContinue) {
    Write-Host "Docker da duoc cai dat." -ForegroundColor Green
    exit 0
}

# Tai Docker Desktop
$downloadUrl = "https://download.docker.com/win/stable/docker-desktop-installer.exe"
$tempFile = Join-Path $env:TEMP "docker-desktop-installer.exe"

Write-Host "Đang tải Docker Desktop Installer..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -UseBasicParsing
Write-Host "Tải thành công: $tempFile" -ForegroundColor Green

# Chạy installer
Write-Host ""
Write-Host "Đang chạy installer..." -ForegroundColor Yellow
Write-Host "Vui lòng xác nhận các hộp thoại cài đặt (Virtualization, WSL2, v.v.)" -ForegroundColor Yellow
& $tempFile /quiet /norestart 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  CAI DAT THANH CONG!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "BƯỚC TIẾP THEO:" -ForegroundColor Yellow
    Write-Host "1. Khởi động lại máy (nếu chưa reboot)"
    Write-Host "2. Chờ Docker Desktop chạy (biểu tượng cá Docker trong system tray)"
    Write-Host "3. Kiểm tra: docker --version"
    Write-Host "4. Login: docker login"
    Write-Host "5. Chạy: .\build-and-push.ps1"
    Write-Host ""
} else {
    Write-Host "Cài đặt thất bại. Mã lỗi: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Vui lòng cài thủ công: $downloadUrl" -ForegroundColor Red
}

# Xóa file installer
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
