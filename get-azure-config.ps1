# Get Azure Configuration Script
# This script retrieves all the environment variables you need

Write-Host "🔍 Fetching your Azure configuration..." -ForegroundColor Cyan
Write-Host ""

# Set subscription
$subscriptionId = "4b0aa994-b965-44b9-88c7-7dee8fb3dac7"
az account set --subscription $subscriptionId

# 1. Get Storage Accounts
Write-Host "📦 Storage Accounts:" -ForegroundColor Yellow
$storageAccounts = az storage account list --resource-group surgical-form-rg --query "[].{Name:name, ResourceGroup:resourceGroup}" -o json | ConvertFrom-Json

if ($storageAccounts) {
    foreach ($sa in $storageAccounts) {
        Write-Host "   Name: $($sa.Name)" -ForegroundColor Green
        
        # Get connection string
        Write-Host "   Getting connection string..." -ForegroundColor Gray
        $connString = az storage account show-connection-string --name $sa.Name --resource-group $sa.ResourceGroup --query "connectionString" -o tsv
        
        Write-Host ""
        Write-Host "   AZURE_STORAGE_CONNECTION_STRING=" -NoNewline -ForegroundColor Cyan
        Write-Host $connString -ForegroundColor White
        Write-Host "   AZURE_STORAGE_ACCOUNT_NAME=" -NoNewline -ForegroundColor Cyan
        Write-Host $sa.Name -ForegroundColor White
        Write-Host "   AZURE_STORAGE_CONTAINER_NAME=" -NoNewline -ForegroundColor Cyan
        Write-Host "uploads" -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host "   No storage accounts found in surgical-form-rg" -ForegroundColor Red
}

# 2. Get PostgreSQL Connection String
Write-Host "🗄️  PostgreSQL Database:" -ForegroundColor Yellow
$dbServer = "surgical-db-new"
$dbAdmin = "surgicaladmin"
Write-Host "   Server: $dbServer" -ForegroundColor Green
Write-Host "   Admin: $dbAdmin" -ForegroundColor Green
Write-Host ""
Write-Host "   DATABASE_URL=" -NoNewline -ForegroundColor Cyan
Write-Host "postgresql://${dbAdmin}:<PASSWORD>@${dbServer}.postgres.database.azure.com:5432/<DATABASE_NAME>?sslmode=require" -ForegroundColor White
Write-Host "   (Replace <PASSWORD> with your actual password)" -ForegroundColor Red
Write-Host "   (Replace <DATABASE_NAME> with your actual database name, likely 'surgical' or 'postgres')" -ForegroundColor Red
Write-Host ""

# 3. Get App Service Configuration
Write-Host "🌐 App Service Configuration:" -ForegroundColor Yellow
Write-Host "   Checking current environment variables in App Service..." -ForegroundColor Gray
Write-Host ""

$appSettings = az webapp config appsettings list --name surgical-backend-new --resource-group surgical-form-rg -o json | ConvertFrom-Json

if ($appSettings) {
    $relevantSettings = $appSettings | Where-Object { $_.name -match "DATABASE|AZURE|STORAGE" }
    
    if ($relevantSettings) {
        Write-Host "   Current App Service Settings:" -ForegroundColor Green
        foreach ($setting in $relevantSettings) {
            Write-Host "   - $($setting.name) = $($setting.value.Substring(0, [Math]::Min(50, $setting.value.Length)))..." -ForegroundColor White
        }
    } else {
        Write-Host "   ⚠️  No DATABASE or STORAGE variables found in App Service!" -ForegroundColor Red
        Write-Host "   You need to configure these in Azure Portal or use the commands below." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy the values above to your local .env file" -ForegroundColor White
Write-Host "2. Update your App Service settings with these values" -ForegroundColor White
Write-Host "3. Replace <PASSWORD> and <DATABASE_NAME> with actual values" -ForegroundColor White
Write-Host ""
Write-Host "💾 To save to .env file, run:" -ForegroundColor Cyan
Write-Host "   notepad backend\.env" -ForegroundColor Yellow
Write-Host ""
Write-Host "☁️  To update App Service settings, run:" -ForegroundColor Cyan
Write-Host "   az webapp config appsettings set --name surgical-backend-new --resource-group surgical-form-rg --settings DATABASE_URL='...' AZURE_STORAGE_CONNECTION_STRING='...'" -ForegroundColor Yellow
Write-Host ""
