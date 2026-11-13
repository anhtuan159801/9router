# build-and-push.ps1
# Build image va push len Docker Hub
# Yeu cau: Da cai Docker Desktop va da login (docker login)
# Chay: .\build-and-push.ps1 YOUR_USERNAME

param(
    [string]$Username = (Read-Host "Docker Hub username")
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BUILD VA PUSH 9ROUTER IMAGE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Kiem tra Docker
if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "Loi: Docker chua duoc cai dat. Chay .\install-docker.ps1 truoc." -ForegroundColor Red
    exit 1
}
Write-Host "Da tim thay Docker." -ForegroundColor Green

# 2. Kiem tra login
$logged = & docker info 2>&1 | Select-String "Username:"
if (-not $logged) {
    Write-Host "Chưa login vào Docker Hub. Chạy: docker login" -ForegroundColor Yellow
    & docker login
}

# 3. Build image
Write-Host ""
Write-Host "Đang build image (có thể mất 10-15 phút)..." -ForegroundColor Yellow
& docker build -t "9router-custom:latest" . 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build that bai. Kiem tra log o tren." -ForegroundColor Red
    exit 1
}
Write-Host "Build thanh cong." -ForegroundColor Green

# 4. Tag image
$tagName = "$Username/9router-custom:latest"
Write-Host ""
Write-Host "Đang tag image: $tagName" -ForegroundColor Yellow
& docker tag "9router-custom:latest" $tagName
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tag that bai." -ForegroundColor Red
    exit 1
}

# 5. Push
Write-Host ""
Write-Host "Đang push lên Docker Hub (có thể mất vài phút)..." -ForegroundColor Yellow
& docker push $tagName 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push that bai. Kiem tra username va permission." -ForegroundColor Red
    exit 1
}
Write-Host "Push thanh cong!" -ForegroundColor Green

# 6. Cap nhat Koyeb
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CAI DAT KOYEB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$KoyebBin = Join-Path $env:LOCALAPPDATA "koyeb\bin\koyeb.exe"
if (Test-Path $KoyebBin) {
    Write-Host "Đang cập nhật Koyeb dùng image moi..." -ForegroundColor Yellow
    & $KoyebBin service update 9router/bb272bb0 --docker $tagName 2>$null
    & $KoyebBin service redeploy 9router/bb272bb0 2>$null
    Write-Host "Koyeb da duoc cap nhat. Chờ deployment xong (5-10 phut)." -ForegroundColor Green
    Write-Host "Kiểm tra: koyeb service get 9router" -ForegroundColor White
} else {
    Write-Host "Koyeb CLI chua duoc cai. Chay: .\install-koyeb.ps1" -ForegroundColor Yellow
}

# Hoi luu
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  HOAN TAT!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Image: $tagName" -ForegroundColor White
Write-Host "Lần sau muốn cập nhật:" -ForegroundColor Yellow
Write-Host "  git pull && .\build-and-push.ps1 $Username" -ForegroundColor White
Write-Host ""
