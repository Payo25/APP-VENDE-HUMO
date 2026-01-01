# Azure Account Migration Guide

This guide will help you migrate the Surgical Forms Application to a new Azure account.

---

## 📋 Pre-Migration Checklist

### 1. **Current Resources to Migrate**
- ✅ Azure App Service (surgical-backend)
- ✅ PostgreSQL Flexible Server (surgical-db-server)
- ✅ Azure Storage Account (surgicalformstorage)
- ✅ GitHub Actions CI/CD pipeline

### 2. **Data to Backup**
- ✅ PostgreSQL database (all tables and data)
- ✅ Uploaded files in Azure Blob Storage (uploads container)
- ✅ Application settings and environment variables

---

## 🔧 Step 1: Export Current Database

### Option A: Using Azure Portal
1. Go to Azure Portal → your PostgreSQL server
2. Click **"Backup and Restore"**
3. Create a manual backup snapshot
4. Note the backup name/timestamp

### Option B: Using pg_dump (Recommended for full control)
```bash
# Install PostgreSQL client if needed
# Windows: Download from https://www.postgresql.org/download/windows/

# Export database
pg_dump -h surgical-db-server.postgres.database.azure.com -U <admin-username> -d <database-name> -F c -b -v -f surgical_backup.dump

# Or export as SQL script
pg_dump -h surgical-db-server.postgres.database.azure.com -U <admin-username> -d <database-name> > surgical_backup.sql
```

**Get credentials from Azure Portal:**
- Server: `surgical-db-server.postgres.database.azure.com`
- Admin username: (check in Azure Portal → PostgreSQL → Settings → Authentication)
- Database name: (check in Azure Portal → PostgreSQL → Databases)

---

## 📦 Step 2: Download Files from Blob Storage

### Using Azure Storage Explorer (Recommended)
1. Download **Azure Storage Explorer**: https://azure.microsoft.com/features/storage-explorer/
2. Connect to your current Azure account
3. Navigate to `surgicalformstorage` → `uploads` container
4. Select all files → Right-click → Download
5. Save to a local folder (e.g., `C:\Medical App\blob-backup\`)

### Using Azure CLI
```powershell
# Install Azure CLI if needed
# https://docs.microsoft.com/cli/azure/install-azure-cli-windows

# Login to current account
az login

# Download all blobs
az storage blob download-batch --account-name surgicalformstorage --source uploads --destination "C:\Medical App\blob-backup\" --auth-mode login
```

---

## 🆕 Step 3: Create New Azure Resources

### 3.1 Create Resource Group
```powershell
# Login to NEW Azure account
az login

# Create resource group
az group create --name surgical-forms-rg --location canadacentral
```

### 3.2 Create PostgreSQL Flexible Server
```powershell
# Create PostgreSQL server
az postgres flexible-server create `
  --name surgical-db-server-new `
  --resource-group surgical-forms-rg `
  --location canadacentral `
  --admin-user surgicaladmin `
  --admin-password "YOUR_STRONG_PASSWORD" `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --version 15 `
  --storage-size 32 `
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create `
  --resource-group surgical-forms-rg `
  --server-name surgical-db-server-new `
  --database-name surgicaldb

# Configure firewall for Azure services
az postgres flexible-server firewall-rule create `
  --resource-group surgical-forms-rg `
  --name surgical-db-server-new `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

### 3.3 Create Storage Account
```powershell
# Create storage account
az storage account create `
  --name surgicalstorageacct `
  --resource-group surgical-forms-rg `
  --location canadacentral `
  --sku Standard_LRS `
  --allow-blob-public-access false

# Get connection string
az storage account show-connection-string `
  --name surgicalstorageacct `
  --resource-group surgical-forms-rg `
  --query connectionString --output tsv

# Create container
az storage container create `
  --name uploads `
  --account-name surgicalstorageacct `
  --public-access off `
  --auth-mode login
```

### 3.4 Create App Service
```powershell
# Create App Service Plan
az appservice plan create `
  --name surgical-app-plan `
  --resource-group surgical-forms-rg `
  --location canadacentral `
  --sku B1 `
  --is-linux

# Create Web App
az webapp create `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --plan surgical-app-plan `
  --runtime "NODE:20-lts"
```

---

## 📤 Step 4: Import Database

### Option A: Using pg_restore (for .dump files)
```bash
pg_restore -h surgical-db-server-new.postgres.database.azure.com -U surgicaladmin -d surgicaldb -v surgical_backup.dump
```

### Option B: Using psql (for .sql files)
```bash
psql -h surgical-db-server-new.postgres.database.azure.com -U surgicaladmin -d surgicaldb -f surgical_backup.sql
```

---

## 📤 Step 5: Upload Files to New Storage

### Using Azure Storage Explorer
1. Connect to NEW Azure account in Storage Explorer
2. Navigate to new storage account → `uploads` container
3. Click Upload → Upload Files
4. Select all files from `C:\Medical App\blob-backup\`
5. Upload

### Using Azure CLI
```powershell
az storage blob upload-batch `
  --account-name surgicalstorageacct `
  --destination uploads `
  --source "C:\Medical App\blob-backup\" `
  --auth-mode login
```

---

## ⚙️ Step 6: Configure App Service Settings

### Get these values ready:

1. **DATABASE_URL** (from new PostgreSQL):
```
postgresql://surgicaladmin:YOUR_PASSWORD@surgical-db-server-new.postgres.database.azure.com:5432/surgicaldb?sslmode=require
```

2. **AZURE_STORAGE_CONNECTION** (from Step 3.3):
```bash
az storage account show-connection-string --name surgicalstorageacct --resource-group surgical-forms-rg --query connectionString --output tsv
```

3. **AZURE_STORAGE_ACCOUNT_NAME**:
```
surgicalstorageacct
```

4. **Optional - SendGrid & Twilio** (if you want notifications):
- SENDGRID_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER

### Set environment variables:
```powershell
# Set database connection
az webapp config appsettings set `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --settings DATABASE_URL="postgresql://surgicaladmin:YOUR_PASSWORD@surgical-db-server-new.postgres.database.azure.com:5432/surgicaldb?sslmode=require"

# Set storage connection
az webapp config appsettings set `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --settings AZURE_STORAGE_CONNECTION="YOUR_CONNECTION_STRING_FROM_STEP_3.3"

# Set storage account name
az webapp config appsettings set `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --settings AZURE_STORAGE_ACCOUNT_NAME="surgicalstorageacct"

# Set Node version
az webapp config appsettings set `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --settings WEBSITE_NODE_DEFAULT_VERSION="20.x"
```

---

## 🚀 Step 7: Update GitHub Repository Settings

### 7.1 Get New Deployment Credentials
```powershell
# Get publish profile
az webapp deployment list-publishing-profiles `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --xml
```

### 7.2 Update GitHub Secrets
1. Go to: https://github.com/Payo25/APP-VENDE-HUMO/settings/secrets/actions
2. Update **AZURE_WEBAPP_PUBLISH_PROFILE** with the XML from Step 7.1
3. Update **AZURE_WEBAPP_NAME** to: `surgical-backend-new`

### 7.3 Update Workflow File (if needed)
File: `.github/workflows/main_surgical-backend.yml`

```yaml
env:
  AZURE_WEBAPP_NAME: surgical-backend-new  # Update this
  AZURE_WEBAPP_PACKAGE_PATH: '.'
  NODE_VERSION: '20.x'
```

---

## 🔍 Step 8: Testing & Verification

### 8.1 Test Database Connection
```powershell
# Test connection
psql -h surgical-db-server-new.postgres.database.azure.com -U surgicaladmin -d surgicaldb -c "SELECT * FROM users LIMIT 5;"
```

### 8.2 Test App Service
```powershell
# Trigger GitHub Actions deployment
git add .
git commit -m "Deploy to new Azure account"
git push

# Wait for deployment to complete, then test:
# https://surgical-backend-new-djb2b3ezgghsdnft.centralus-01.azurewebsites.net
```

### 8.3 Verification Checklist
- [ ] Can login with existing users
- [ ] Can view surgical forms
- [ ] Can create new surgical form
- [ ] Can upload files (test with small file)
- [ ] Can download files
- [ ] Can view call hours
- [ ] Can create/edit call hours (Business Assistant/Team Leader)
- [ ] Health centers page loads correctly
- [ ] User management works (Admin only)

---

## 🔐 Step 9: Security & Final Steps

### 9.1 Update CORS Settings (if needed)
```powershell
az webapp cors add `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --allowed-origins "https://surgical-backend-new-djb2b3ezgghsdnft.centralus-01.azurewebsites.net"
```

### 9.2 Configure Custom Domain (Optional)
If you have a custom domain:
```powershell
# Add custom domain
az webapp config hostname add `
  --webapp-name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --hostname yourdomain.com

# Enable HTTPS
az webapp update `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --https-only true
```

### 9.3 Enable Application Insights (Recommended)
```powershell
az monitor app-insights component create `
  --app surgical-backend-insights `
  --location canadacentral `
  --resource-group surgical-forms-rg

# Link to App Service
az webapp config appsettings set `
  --name surgical-backend-new `
  --resource-group surgical-forms-rg `
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="<key-from-previous-command>"
```

---

## 🗑️ Step 10: Cleanup Old Resources (AFTER VERIFICATION)

**⚠️ WARNING: Only do this after confirming everything works in the new account!**

```powershell
# Login to OLD Azure account
az login

# Delete old resource group (removes all resources)
az group delete --name <old-resource-group-name> --yes
```

---

## 📝 Quick Migration Checklist

- [ ] Export database from old account
- [ ] Download all blob storage files
- [ ] Create new Azure resources (PostgreSQL, Storage, App Service)
- [ ] Import database to new PostgreSQL
- [ ] Upload files to new blob storage
- [ ] Configure App Service environment variables
- [ ] Update GitHub secrets with new publish profile
- [ ] Deploy application via GitHub Actions
- [ ] Test all functionality
- [ ] Update DNS/custom domain (if applicable)
- [ ] Verify everything works for 24-48 hours
- [ ] Delete old resources

---

## 🆘 Troubleshooting

### Database connection issues:
```bash
# Check firewall rules
az postgres flexible-server firewall-rule list --resource-group surgical-forms-rg --name surgical-db-server-new

# Add your IP temporarily for testing
az postgres flexible-server firewall-rule create --resource-group surgical-forms-rg --name surgical-db-server-new --rule-name MyIP --start-ip-address YOUR_IP --end-ip-address YOUR_IP
```

### Storage access issues:
```bash
# Check storage account key
az storage account keys list --account-name surgicalstorageacct --resource-group surgical-forms-rg
```

### App Service not starting:
```bash
# View logs
az webapp log tail --name surgical-backend-new --resource-group surgical-forms-rg

# Or download logs
az webapp log download --name surgical-backend-new --resource-group surgical-forms-rg --log-file logs.zip
```

---

## 💰 Cost Estimate (New Account)

Approximate monthly costs:
- App Service (B1): ~$13/month
- PostgreSQL (Standard_B1ms): ~$25/month  
- Storage Account (LRS, minimal usage): ~$2/month
- **Total: ~$40/month**

*Prices may vary by region and actual usage*

---

## 📞 Support

If you encounter issues during migration:
1. Check Azure Portal → Resource → Diagnose and solve problems
2. Review App Service logs
3. Check PostgreSQL connection strings
4. Verify environment variables are set correctly

---

**Good luck with your migration! 🚀**
