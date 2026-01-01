# ✅ Your Azure Resources Found

Based on your Azure account scan, here's what you have:

## 📦 Resources

1. **PostgreSQL Database Server**
   - Name: `surgical-db-new`
   - Location: Central US
   - Admin Username: `surgicaladmin`
   
2. **Storage Account**
   - Name: `surgicalstorage2025`
   - Location: Central US
   - Resource Group: `surgical-form-rg`

3. **App Service**
   - Name: `surgical-backend-new`
   - Resource Group: `surgical-form-rg`

---

## 🔑 How to Get Your Environment Variables

### Option 1: Azure Portal (Easiest)

#### A. Get Storage Connection String:
1. Go to: https://portal.azure.com
2. Navigate to **Storage accounts** → `surgicalstorage2025`
3. In the left menu, click **Access keys**
4. Copy the **Connection string** under **key1**
5. This is your `AZURE_STORAGE_CONNECTION_STRING`

#### B. Get Database Connection String:
1. Go to **Azure Database for PostgreSQL flexible servers** → `surgical-db-new`
2. Click **Connection strings** in the left menu
3. Copy the connection string (it will look like):
   ```
   postgresql://surgicaladmin:{your_password}@surgical-db-new.postgres.database.azure.com:5432/postgres?sslmode=require
   ```
4. Replace `{your_password}` with the actual password you set
5. Replace `postgres` with your database name if different (likely `surgical` or `surgicalforms`)

---

## 📝 Your .env File Configuration

Create or update `backend/.env` with these values:

```bash
# Database Configuration
DATABASE_URL=postgresql://surgicaladmin:YOUR_PASSWORD@surgical-db-new.postgres.database.azure.com:5432/YOUR_DATABASE_NAME?sslmode=require

# Azure Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=surgicalstorage2025;AccountKey=YOUR_KEY_HERE;EndpointSuffix=core.windows.net
AZURE_STORAGE_ACCOUNT_NAME=surgicalstorage2025
AZURE_STORAGE_CONTAINER_NAME=uploads

# Optional: Email & SMS Notifications (if needed)
# SENDGRID_API_KEY=
# NOTIFICATION_EMAIL_FROM=
# NOTIFICATION_EMAIL_TO=
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE_FROM=
# NOTIFICATION_PHONE_TO=
# APP_URL=https://surgical-backend-new-djb2b3ezgghsdnft.centralus-01.azurewebsites.net
```

---

## ☁️ Update App Service Configuration

### Option A: Azure Portal
1. Go to App Service → `surgical-backend-new`
2. Click **Configuration** → **Application settings**
3. Add these settings:
   - `DATABASE_URL` = (your connection string)
   - `AZURE_STORAGE_CONNECTION_STRING` = (your storage connection string)
   - `AZURE_STORAGE_ACCOUNT_NAME` = `surgicalstorage2025`
   - `AZURE_STORAGE_CONTAINER_NAME` = `uploads`
4. Click **Save** at the top

### Option B: Azure CLI (if connection stabilizes)
```powershell
az webapp config appsettings set `
  --name surgical-backend-new `
  --resource-group surgical-form-rg `
  --settings `
    DATABASE_URL="postgresql://surgicaladmin:PASSWORD@surgical-db-new.postgres.database.azure.com:5432/DATABASE_NAME?sslmode=require" `
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=surgicalstorage2025;AccountKey=KEY;EndpointSuffix=core.windows.net" `
    AZURE_STORAGE_ACCOUNT_NAME="surgicalstorage2025" `
    AZURE_STORAGE_CONTAINER_NAME="uploads"
```

---

## 🚀 Next Steps

### 1. Update Local .env File
```powershell
cd "c:\Medical App\surgical-forms-app-main\backend"
notepad .env
```

### 2. Verify Storage Container Exists
Make sure the `uploads` container exists in your storage account:
- Portal → Storage account → Containers → Check if `uploads` exists
- If not, create it (Public access level: Blob)

### 3. Test Database Connection
```powershell
cd "c:\Medical App\surgical-forms-app-main\backend"
node test-login.js
```

### 4. Initialize Database (if needed)
```powershell
npm run init-db
```

### 5. Create Admin User (if needed)
```powershell
node create-admin.js
```

### 6. Start Backend
```powershell
npm start
```

Then visit: http://localhost:3001/api/health

---

## ✅ Checklist

- [ ] Get Storage Connection String from Portal
- [ ] Get Database Connection String from Portal
- [ ] Update `backend/.env` file
- [ ] Verify `uploads` container exists
- [ ] Initialize database schema
- [ ] Create admin user
- [ ] Test backend locally
- [ ] Update App Service configuration in Azure
- [ ] Restart App Service

---

## 🆘 Troubleshooting

### Connection Issues?
- Ensure PostgreSQL firewall allows your IP
- Check that Public Network Access is enabled
- Verify password is correct

### Storage Issues?
- Verify container name is exactly `uploads`
- Check storage account has correct access level
- Ensure connection string has no extra spaces

### Need Help?
Run the health check: `http://localhost:3001/api/health`
- Should show: `"status": "ok"` and `"hasEnvVar": true`
