# Check Azure Deployment Status

Write-Host "🔍 Checking Azure App Service Status..." -ForegroundColor Cyan
Write-Host ""

$appUrl = "https://surgical-backend-new-djb2b3ezgghsdnft.centralus-01.azurewebsites.net"
$healthUrl = "$appUrl/api/health"

Write-Host "📡 Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 10
    Write-Host "✅ App is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 3
    Write-Host ""
    Write-Host "🌐 Your app is live at: $appUrl" -ForegroundColor Green
    Write-Host "📝 Login with: admin@example.com / admin123" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Message -match "404") {
        Write-Host "⚠️  App is running but health endpoint returned 404" -ForegroundColor Yellow
        Write-Host "   This might mean the app hasn't fully started yet." -ForegroundColor Gray
    } elseif ($_.Exception.Message -match "503") {
        Write-Host "⚠️  App Service is starting up (503)..." -ForegroundColor Yellow
        Write-Host "   Wait a minute and try again." -ForegroundColor Gray
    } else {
        Write-Host "❌ Cannot reach app: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible reasons:" -ForegroundColor Yellow
        Write-Host "  - Deployment still in progress (check GitHub Actions)" -ForegroundColor Gray
        Write-Host "  - App is cold starting (first request takes longer)" -ForegroundColor Gray
        Write-Host "  - Configuration issue (check Azure Portal logs)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "📊 Check deployment status:" -ForegroundColor Cyan
    Write-Host "   GitHub Actions: https://github.com/Payo25/APP-VENDE-HUMO/actions" -ForegroundColor White
    Write-Host "   Azure Portal: https://portal.azure.com" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
