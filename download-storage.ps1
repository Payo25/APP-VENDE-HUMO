# Download all files from OLD storage account
# You'll need Azure CLI for this

Write-Host "📦 Downloading files from OLD storage account..." -ForegroundColor Cyan

$OLD_STORAGE = "surgicalformstorage"
$CONTAINER = "uploads"
$DOWNLOAD_PATH = "C:\Medical App\blob-backup"

# Create download directory
New-Item -ItemType Directory -Force -Path $DOWNLOAD_PATH | Out-Null

Write-Host "📁 Saving to: $DOWNLOAD_PATH" -ForegroundColor Yellow

# Download all blobs
az storage blob download-batch `
    --account-name $OLD_STORAGE `
    --source $CONTAINER `
    --destination $DOWNLOAD_PATH `
    --auth-mode login

if ($LASTEXITCODE -eq 0) {
    $fileCount = (Get-ChildItem $DOWNLOAD_PATH -File).Count
    Write-Host ""
    Write-Host "✅ Downloaded $fileCount files successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Download failed. Make sure you're logged into Azure CLI:" -ForegroundColor Red
    Write-Host "   Run: az login" -ForegroundColor Yellow
}
