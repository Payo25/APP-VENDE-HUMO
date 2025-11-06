# Deploy to Azure Script
# This script configures and deploys the Surgical Forms App to Azure

Write-Host "🚀 Deploying Surgical Forms App to Azure..." -ForegroundColor Cyan
Write-Host ""

# Variables
$appName = "surgical-backend-new"
$resourceGroup = "surgical-form-rg"
$subscriptionId = "4b0aa994-b965-44b9-88c7-7dee8fb3dac7"

# Set subscription
Write-Host "📌 Setting Azure subscription..." -ForegroundColor Yellow
az account set --subscription $subscriptionId

# Step 1: Configure App Service Settings
Write-Host ""
Write-Host "⚙️  Configuring App Service environment variables..." -ForegroundColor Yellow

# Create settings JSON file to avoid command line issues
$settings = @{
    DATABASE_URL = "postgresql://surgicaladmin:Alondra2633658`$@surgical-db-new.postgres.database.azure.com:5432/postgres?sslmode=require"
    AZURE_STORAGE_CONNECTION = "DefaultEndpointsProtocol=https;AccountName=surgicalstorage2025;AccountKey=YOUR_STORAGE_KEY_HERE;EndpointSuffix=core.windows.net"
    AZURE_STORAGE_ACCOUNT_NAME = "surgicalstorage2025"
    AZURE_STORAGE_CONTAINER_NAME = "uploads"
    NODE_ENV = "production"
}

# Set each setting individually
foreach ($key in $settings.Keys) {
    Write-Host "  Setting $key..." -ForegroundColor Gray
    az webapp config appsettings set `
        --name $appName `
        --resource-group $resourceGroup `
        --settings "$key=$($settings[$key])" `
        --output none
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ $key configured" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Failed to set $key" -ForegroundColor Red
    }
}

# Step 2: Check if frontend build exists
Write-Host ""
Write-Host "🔨 Checking frontend build..." -ForegroundColor Yellow
$frontendBuildPath = "c:\Medical App\surgical-forms-app-main\frontend\build"
$backendBuildPath = "c:\Medical App\surgical-forms-app-main\backend\build"

if (Test-Path $frontendBuildPath) {
    Write-Host "✅ Frontend build found" -ForegroundColor Green
    
    # Copy to backend
    if (Test-Path $backendBuildPath) {
        Remove-Item $backendBuildPath -Recurse -Force
    }
    Copy-Item -Path $frontendBuildPath -Destination $backendBuildPath -Recurse
    Write-Host "✅ Frontend build copied to backend" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend build not found. Building now..." -ForegroundColor Yellow
    Set-Location "c:\Medical App\surgical-forms-app-main\frontend"
    npm run build
    Copy-Item -Path $frontendBuildPath -Destination $backendBuildPath -Recurse
    Set-Location "c:\Medical App\surgical-forms-app-main"
}

# Step 3: Commit and Push to trigger GitHub Actions deployment
Write-Host ""
Write-Host "📦 Preparing Git commit..." -ForegroundColor Yellow

git add frontend/package.json
git add .env.example
git add .github/copilot-instructions.md
git add *GUIDE.md
git add *.md
git add *.ps1
git add backend/migrate-data.js
git add backend/start-test.js

Write-Host ""
Write-Host "💬 Creating commit..." -ForegroundColor Yellow
git commit -m "Deploy: Configure environment and update application settings"

Write-Host ""
Write-Host "⬆️  Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "   This will trigger GitHub Actions deployment to Azure..." -ForegroundColor Gray
git push origin main

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Deployment initiated!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Monitor deployment:" -ForegroundColor Cyan
Write-Host "   GitHub Actions: https://github.com/Payo25/APP-VENDE-HUMO/actions" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Your app will be available at:" -ForegroundColor Cyan
Write-Host "   https://surgical-backend-new.azurewebsites.net" -ForegroundColor White
Write-Host ""
Write-Host "⏱️  Deployment typically takes 3-5 minutes..." -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Wait for GitHub Actions to complete" -ForegroundColor White
Write-Host "   2. Visit your app URL" -ForegroundColor White
Write-Host "   3. Login with: admin@example.com / admin123" -ForegroundColor White
Write-Host ""
