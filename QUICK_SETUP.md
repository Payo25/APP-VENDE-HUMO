# Quick Setup Guide - Environment Variables

You've cloned the app! Now you need to configure your environment variables.

## ✅ Required Environment Variables

### 1. DATABASE_URL
Your PostgreSQL connection string from Azure:
```
DATABASE_URL=postgresql://username:password@yourserver.postgres.database.azure.com:5432/database_name?sslmode=require
```

**How to get it:**
- Azure Portal → Your PostgreSQL Flexible Server → Connection strings
- Or use: `az postgres flexible-server show-connection-string`

### 2. AZURE_STORAGE_CONNECTION_STRING
Your Azure Storage account connection string:
```
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey==;EndpointSuffix=core.windows.net
```

**How to get it:**
- Azure Portal → Storage Account → Access keys → Connection string
- Or use: `az storage account show-connection-string --name youraccount --resource-group yourgroup`

### 3. AZURE_STORAGE_ACCOUNT_NAME
Your storage account name:
```
AZURE_STORAGE_ACCOUNT_NAME=yourstorageaccountname
```

### 4. AZURE_STORAGE_CONTAINER_NAME
The container for file uploads (usually "uploads"):
```
AZURE_STORAGE_CONTAINER_NAME=uploads
```

---

## 🚀 Setup Steps

### Option 1: Local Development (.env file)

1. **Create `.env` file in the `backend` folder:**
   ```powershell
   cd "c:\Medical App\surgical-forms-app-main\backend"
   Copy-Item ..\.env.example .env
   notepad .env
   ```

2. **Edit `.env` with your actual values:**
   ```
   DATABASE_URL=postgresql://...
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
   AZURE_STORAGE_ACCOUNT_NAME=youraccountname
   AZURE_STORAGE_CONTAINER_NAME=uploads
   ```

3. **Initialize the database:**
   ```powershell
   npm run init-db
   ```

4. **Create an admin user:**
   ```powershell
   node create-admin.js
   ```

5. **Start the backend:**
   ```powershell
   npm start
   ```

### Option 2: Azure App Service (Production)

1. **Set Application Settings in Azure Portal:**
   - Go to App Service → Configuration → Application settings
   - Add each environment variable as a new application setting
   - Click "Save"

2. **Or use Azure CLI:**
   ```powershell
   az webapp config appsettings set --name your-app-name --resource-group your-resource-group --settings `
     DATABASE_URL="postgresql://..." `
     AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=..." `
     AZURE_STORAGE_ACCOUNT_NAME="youraccountname" `
     AZURE_STORAGE_CONTAINER_NAME="uploads"
   ```

---

## 🔍 Verify Configuration

### Test Backend Connection:
```powershell
cd "c:\Medical App\surgical-forms-app-main\backend"
npm start
```

Then visit: http://localhost:3001/api/health

You should see:
```json
{
  "status": "ok",
  "database": { ... },
  "userCount": "...",
  "hasEnvVar": true
}
```

### Check Logs:
Look for these startup messages:
- ✅ Azure Blob Storage configured
- ✅ Database schema updated
- ✅ Server running on port 3001

---

## ⚠️ Troubleshooting

### Database Connection Issues:
```powershell
# Test database connection directly
node test-login.js
```

### Storage Issues:
- Verify the "uploads" container exists in your storage account
- Check that connection string is correct (no extra spaces)
- Ensure storage account allows public blob access or uses SAS tokens

### Missing Variables:
Check if variables are loaded:
```javascript
// In backend/index.js, this is already done:
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('AZURE_STORAGE set:', !!process.env.AZURE_STORAGE_CONNECTION_STRING);
```

---

## 📚 Next Steps

1. ✅ Set up environment variables (you are here)
2. Initialize database schema
3. Create admin user
4. Test file uploads
5. Configure optional notifications (SendGrid/Twilio)
6. Deploy to Azure

See `CLONE_TO_NEW_AZURE_ACCOUNT.md` for full migration guide.
