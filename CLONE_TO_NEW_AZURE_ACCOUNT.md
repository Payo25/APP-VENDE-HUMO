# Clone Surgical Forms App to New Azure Account

This guide will help you clone your entire app (App Service + PostgreSQL + Blob Storage + data) to a different Azure account.

---

## 📋 Overview

**Current Setup (Source):**
- App Service: `surgical-backend` (Windows, Node 20)
- Resource Group: `medical` 
- Location: Canada Central
- PostgreSQL Flexible Server (from your connection string)
- Azure Storage Account with `uploads` container
- GitHub Actions deployment

**Target Setup (New Account):**
- You'll create matching resources in the new Azure subscription
- Same configuration but in a fresh account

---

## 🔐 Step 1: Authenticate to BOTH Azure Accounts

You'll need to switch between accounts during this process.

### Login to SOURCE account (current)
```powershell
# Login to your CURRENT Azure account
az login

# Verify you're in the right subscription
az account show

# Set the source subscription (replace with your actual subscription ID)
az account set --subscription "fdb4c318-3f29-42a2-bd19-c60c00255237"
```

### Login to TARGET account (new - do this later)
```powershell
# When ready to create resources, login to NEW Azure account
az login --tenant <new-tenant-id>

# List subscriptions in new account
az account list --output table

# Set the target subscription
az account set --subscription "<new-subscription-id>"
```

---

## 📦 Step 2: Export Database from Current Account

### Option A: Using Azure Portal Backup (Easiest)
1. Go to Azure Portal → PostgreSQL server
2. Navigate to **Backup and Restore**
3. Create an on-demand backup
4. Note the backup name

### Option B: Using pg_dump (More Control)
```powershell
# Get your current database details from environment variable or Azure Portal
# Format: postgresql://username:password@server.postgres.database.azure.com:5432/database

# Export to custom format (recommended for large DBs)
pg_dump -h <your-server>.postgres.database.azure.com `
  -U <admin-username> `
  -d <database-name> `
  -F c `
  -b `
  -v `
  -f "C:\Medical App\surgical_backup_$(Get-Date -Format 'yyyy-MM-dd').dump"

# OR export as SQL script (easier to inspect)
pg_dump -h <your-server>.postgres.database.azure.com `
  -U <admin-username> `
  -d <database-name> `
  --clean `
  --if-exists `
  > "C:\Medical App\surgical_backup_$(Get-Date -Format 'yyyy-MM-dd').sql"
```

**Get connection details:**
```powershell
# If you have the App Service name, get connection string
az webapp config connection-string list `
  --name surgical-backend `
  --resource-group medical
```

---

## 📁 Step 3: Download Blob Storage Files

### Using Azure Storage Explorer (Recommended for GUI)
1. Download: https://azure.microsoft.com/features/storage-explorer/
2. Connect to your current Azure account
3. Navigate to storage account → `uploads` container
4. Select all files → Download
5. Save to: `C:\Medical App\blob-backup\`

### Using Azure CLI
```powershell
# First, find your storage account name
az storage account list --resource-group medical --output table

# Set storage account name
$STORAGE_ACCOUNT = "<your-storage-account-name>"

# Download all blobs from uploads container
az storage blob download-batch `
  --account-name $STORAGE_ACCOUNT `
  --source uploads `
  --destination "C:\Medical App\blob-backup\" `
  --auth-mode login
```

---

## 🆕 Step 4: Create Resources in NEW Azure Account

**Switch to your NEW Azure account:**
```powershell
# Login to new account
az login --tenant <new-tenant-id>
az account set --subscription "<new-subscription-id>"
```

### Variables for new deployment
```powershell
$NEW_RG = "surgical-forms-rg"
$NEW_LOCATION = "canadacentral"
$NEW_APP_NAME = "surgical-backend-new"
$NEW_DB_SERVER = "surgical-db-server-new"
$NEW_DB_NAME = "surgicaldb"
$NEW_DB_ADMIN = "surgicaladmin"
$NEW_DB_PASSWORD = "YourSecurePassword123!"  # Change this!
$NEW_STORAGE = "surgicalstoragenew"  # Must be globally unique, lowercase, no hyphens
```

### Create Resource Group
```powershell
az group create `
  --name $NEW_RG `
  --location $NEW_LOCATION
```

### Create PostgreSQL Flexible Server
```powershell
az postgres flexible-server create `
  --name $NEW_DB_SERVER `
  --resource-group $NEW_RG `
  --location $NEW_LOCATION `
  --admin-user $NEW_DB_ADMIN `
  --admin-password $NEW_DB_PASSWORD `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --version 15 `
  --storage-size 32 `
  --public-access 0.0.0.0-255.255.255.255

# Create database
az postgres flexible-server db create `
  --resource-group $NEW_RG `
  --server-name $NEW_DB_SERVER `
  --database-name $NEW_DB_NAME

# Allow Azure services to access
az postgres flexible-server firewall-rule create `
  --resource-group $NEW_RG `
  --name $NEW_DB_SERVER `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

### Create Storage Account
```powershell
az storage account create `
  --name $NEW_STORAGE `
  --resource-group $NEW_RG `
  --location $NEW_LOCATION `
  --sku Standard_LRS `
  --allow-blob-public-access false

# Create uploads container
az storage container create `
  --name uploads `
  --account-name $NEW_STORAGE `
  --public-access off `
  --auth-mode login

# Get connection string for later
az storage account show-connection-string `
  --name $NEW_STORAGE `
  --resource-group $NEW_RG `
  --query connectionString `
  --output tsv
```

### Create App Service
```powershell
# Create App Service Plan (Windows)
az appservice plan create `
  --name surgical-app-plan `
  --resource-group $NEW_RG `
  --location $NEW_LOCATION `
  --sku B1 `
  --is-linux $false

# Create Web App (Windows with Node)
az webapp create `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --plan surgical-app-plan `
  --runtime "NODE:20LTS"

# Configure Node version
az webapp config appsettings set `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --settings WEBSITE_NODE_DEFAULT_VERSION="~20"
```

---

## 📤 Step 5: Import Database

```powershell
# Build connection string for new database
$NEW_DB_CONNECTION = "postgresql://${NEW_DB_ADMIN}:${NEW_DB_PASSWORD}@${NEW_DB_SERVER}.postgres.database.azure.com:5432/${NEW_DB_NAME}?sslmode=require"

# Restore from custom format dump
pg_restore `
  -h "${NEW_DB_SERVER}.postgres.database.azure.com" `
  -U $NEW_DB_ADMIN `
  -d $NEW_DB_NAME `
  -v `
  "C:\Medical App\surgical_backup_*.dump"

# OR restore from SQL file
psql `
  -h "${NEW_DB_SERVER}.postgres.database.azure.com" `
  -U $NEW_DB_ADMIN `
  -d $NEW_DB_NAME `
  -f "C:\Medical App\surgical_backup_*.sql"
```

---

## 📤 Step 6: Upload Files to New Storage

```powershell
# Upload all files to new storage account
az storage blob upload-batch `
  --account-name $NEW_STORAGE `
  --destination uploads `
  --source "C:\Medical App\blob-backup\" `
  --auth-mode login
```

---

## ⚙️ Step 7: Configure App Settings

```powershell
# Set DATABASE_URL
az webapp config appsettings set `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --settings DATABASE_URL="$NEW_DB_CONNECTION"

# Get and set storage connection string
$STORAGE_CONNECTION = az storage account show-connection-string `
  --name $NEW_STORAGE `
  --resource-group $NEW_RG `
  --query connectionString `
  --output tsv

az webapp config appsettings set `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --settings AZURE_STORAGE_CONNECTION="$STORAGE_CONNECTION"

# Set storage account name
az webapp config appsettings set `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --settings AZURE_STORAGE_ACCOUNT_NAME="$NEW_STORAGE"

# Optional: Set notification settings (SendGrid, Twilio)
az webapp config appsettings set `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --settings `
    SENDGRID_API_KEY="<your-key>" `
    NOTIFICATION_EMAIL_FROM="notifications@yourdomain.com" `
    NOTIFICATION_EMAIL_TO="recipient@example.com" `
    TWILIO_ACCOUNT_SID="<your-sid>" `
    TWILIO_AUTH_TOKEN="<your-token>" `
    TWILIO_PHONE_FROM="+1234567890" `
    NOTIFICATION_PHONE_TO="+1234567890" `
    APP_URL="https://${NEW_APP_NAME}.azurewebsites.net"
```

---

## 🚀 Step 8: Deploy Application Code

### Option A: Deploy from Local (Quick Test)
```powershell
# Navigate to backend directory
cd "C:\Medical App\surgical-forms-app-main\backend"

# Install dependencies
npm install

# Build frontend first
cd ..\frontend
npm install
npm run build

# Copy frontend build to backend
Copy-Item -Recurse -Force ".\build" "..\backend\build"

# Deploy from backend directory
cd ..\backend
az webapp up `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --runtime "NODE:20LTS"
```

### Option B: Setup GitHub Actions (Recommended for Production)

1. **Get publish profile:**
```powershell
az webapp deployment list-publishing-profiles `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --xml
```

2. **Update GitHub Repository Secrets:**
   - Go to: https://github.com/Payo25/APP-VENDE-HUMO/settings/secrets/actions
   - Create or update:
     - `AZURE_WEBAPP_PUBLISH_PROFILE_NEW` → paste XML from step 1
     - `AZURE_WEBAPP_NAME_NEW` → `surgical-backend-new`

3. **Create new workflow or update existing:**
   Create `.github/workflows/deploy-new-account.yml`:

```yaml
name: Deploy to New Azure Account

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  AZURE_WEBAPP_NAME: surgical-backend-new
  NODE_VERSION: '20.x'

jobs:
  build-and-deploy:
    runs-on: windows-latest
    steps:
    - uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}

    - name: Install and build frontend
      run: |
        cd frontend
        npm ci
        npm run build
        
    - name: Copy frontend build to backend
      run: |
        Copy-Item -Recurse -Force frontend/build backend/build

    - name: Install backend dependencies
      run: |
        cd backend
        npm ci --production

    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ env.AZURE_WEBAPP_NAME }}
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE_NEW }}
        package: ./backend
```

4. **Push to trigger deployment:**
```powershell
git add .github/workflows/deploy-new-account.yml
git commit -m "Add deployment workflow for new Azure account"
git push
```

---

## ✅ Step 9: Verify & Test

```powershell
# Check app status
az webapp show `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --query "{name:name, state:state, defaultHostName:defaultHostName}" `
  --output table

# Get the URL
$APP_URL = "https://${NEW_APP_NAME}.azurewebsites.net"
Write-Host "App URL: $APP_URL"

# View logs
az webapp log tail `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG
```

**Test in browser:**
1. Navigate to: `https://surgical-backend-new-djb2b3ezgghsdnft.centralus-01.azurewebsites.net`
2. Login with: `admin@example.com` / `admin123`
3. Verify:
   - ✅ Can view surgical forms
   - ✅ Can create new form with file upload
   - ✅ Files download correctly
   - ✅ User management works
   - ✅ Call hours functionality

---

## 🔒 Step 10: Security & Final Steps

### Update CORS if needed
```powershell
az webapp cors add `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --allowed-origins "https://${NEW_APP_NAME}.azurewebsites.net"
```

### Enable HTTPS only
```powershell
az webapp update `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --https-only true
```

### Restrict database access (after testing)
```powershell
# Remove public access rule
az postgres flexible-server firewall-rule delete `
  --resource-group $NEW_RG `
  --name $NEW_DB_SERVER `
  --rule-name AllowAzureServices `
  --yes

# Add only App Service IPs (more secure)
$WEBAPP_IPS = az webapp show `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --query "outboundIpAddresses" `
  --output tsv

# Split IPs and add firewall rules for each
$WEBAPP_IPS -split ',' | ForEach-Object {
  $ip = $_.Trim()
  az postgres flexible-server firewall-rule create `
    --resource-group $NEW_RG `
    --name $NEW_DB_SERVER `
    --rule-name "AppService-$($ip -replace '\.', '-')" `
    --start-ip-address $ip `
    --end-ip-address $ip
}
```

---

## 💰 Cost Estimate (New Account)

- App Service (B1): ~$13/month
- PostgreSQL (Standard_B1ms): ~$25/month
- Storage (LRS, typical usage): ~$2/month
- **Total: ~$40/month**

---

## 🆘 Troubleshooting

### Database connection issues
```powershell
# Test connection
psql -h "${NEW_DB_SERVER}.postgres.database.azure.com" `
  -U $NEW_DB_ADMIN `
  -d $NEW_DB_NAME `
  -c "SELECT COUNT(*) FROM users;"

# Check firewall rules
az postgres flexible-server firewall-rule list `
  --resource-group $NEW_RG `
  --name $NEW_DB_SERVER `
  --output table
```

### Storage access issues
```powershell
# Test blob access
az storage blob list `
  --account-name $NEW_STORAGE `
  --container-name uploads `
  --auth-mode login

# Regenerate keys if needed
az storage account keys renew `
  --account-name $NEW_STORAGE `
  --resource-group $NEW_RG `
  --key primary
```

### App not starting
```powershell
# Check configuration
az webapp config appsettings list `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG `
  --output table

# View live logs
az webapp log tail `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG

# Restart app
az webapp restart `
  --name $NEW_APP_NAME `
  --resource-group $NEW_RG
```

---

## 📋 Quick Checklist

- [ ] Exported database from current account
- [ ] Downloaded all blob storage files
- [ ] Created new resource group
- [ ] Created PostgreSQL server and database
- [ ] Created storage account and uploads container
- [ ] Created App Service (Windows, Node 20)
- [ ] Imported database to new account
- [ ] Uploaded files to new storage
- [ ] Set all environment variables
- [ ] Deployed application code
- [ ] Tested login and all features
- [ ] Configured HTTPS and security settings
- [ ] Updated GitHub Actions (if using)
- [ ] Verified for 24-48 hours before cleanup

---

## 🎯 Next Steps

1. Run through this guide step by step
2. Test thoroughly in new account
3. Update any external integrations (if applicable)
4. Consider setting up custom domain
5. After verification, optionally clean up old resources

**Need help?** Check Azure Portal logs or run diagnostic commands above.

Good luck with your migration! 🚀
