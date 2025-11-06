# Post-Clone Setup Checklist

Your app has been cloned! Now follow these steps to complete the migration.

---

## 🎯 Quick Overview

The clone copied your **app code and settings**, but NOT:
- ❌ Database data
- ❌ Uploaded files in blob storage

Let's fix that!

---

## Step 1: Create New PostgreSQL Database (Azure Portal)

### A. Create PostgreSQL Server
1. Go to Azure Portal → **Create a resource**
2. Search for **"Azure Database for PostgreSQL Flexible Server"**
3. Click **Create**

**Fill in the form:**
- **Resource group:** Select your NEW resource group (where cloned app is)
- **Server name:** `surgical-db-new` (or any unique name)
- **Region:** Canada Central
- **PostgreSQL version:** 15
- **Workload type:** Development (for testing) or Production (for live use)
- **Compute + storage:** 
  - Burstable, B1ms (1 vCore, 2 GiB RAM) - ~$25/month
  - Storage: 32 GiB
- **Admin username:** `surgicaladmin`
- **Password:** Create a strong password and SAVE IT!

**Networking tab:**
- **Connectivity method:** Public access
- **Firewall rules:** 
  - ✅ Check "Allow public access from any Azure service"
  - ✅ Add your current IP address (for testing)

4. Click **Review + create** → **Create**
5. Wait 5-10 minutes for deployment

### B. Create Database Inside Server
1. After deployment, go to your new PostgreSQL server
2. Left menu → **Databases**
3. Click **+ Add** 
4. **Database name:** `surgicaldb`
5. Click **Save**

### C. Get Connection String
```
postgresql://surgicaladmin:[YOUR-PASSWORD]@surgical-db-new.postgres.database.azure.com:5432/surgicaldb?sslmode=require
```
**Save this - you'll need it later!**

---

## Step 2: Export Database from Old Server

### Option A: Using Azure Portal (Easiest)

1. Go to your **ORIGINAL** PostgreSQL server
2. Left menu → **Backup and Restore**
3. Click **Backup now** (creates a point-in-time backup)

### Option B: Using Azure Data Studio (Recommended)

**Install Azure Data Studio:**
- Download: https://aka.ms/azuredatastudio
- Install and launch

**Export the database:**
1. Click **New Connection**
2. **Server:** Your old PostgreSQL server hostname
   - Find it in Azure Portal → Old PostgreSQL server → Overview → Server name
   - Example: `surgical-db-server.postgres.database.azure.com`
3. **User name:** Your admin username
4. **Password:** Your admin password
5. **Database:** `surgicaldb` (or your database name)
6. Click **Connect**

7. Right-click on the database → **Backup**
8. Save as: `C:\Medical App\surgical_backup.sql`

### Option C: Using pgAdmin (Alternative GUI)

1. Download pgAdmin: https://www.pgadmin.org/download/
2. Add new server connection (same credentials as Azure Data Studio)
3. Right-click database → **Backup**
4. Save to: `C:\Medical App\surgical_backup.sql`

---

## Step 3: Import Database to New Server

### Using Azure Data Studio:

1. Connect to your **NEW** PostgreSQL server
   - Server: `surgical-db-new.postgres.database.azure.com`
   - Username: `surgicaladmin`
   - Password: [your new password]
   - Database: `surgicaldb`

2. Click **New Query**

3. Open your backup file:
   - File → Open File
   - Select: `C:\Medical App\surgical_backup.sql`

4. Click **Run** to execute the SQL

5. Verify import:
   - Run query: `SELECT COUNT(*) FROM users;`
   - Should return number of users from old database

---

## Step 4: Create New Storage Account

1. Azure Portal → **Create a resource**
2. Search for **"Storage account"**
3. Click **Create**

**Fill in the form:**
- **Resource group:** Your NEW resource group
- **Storage account name:** `surgicalstoragenew` (must be globally unique, lowercase, no hyphens)
- **Region:** Canada Central
- **Performance:** Standard
- **Redundancy:** Locally-redundant storage (LRS)

**Advanced tab:**
- Leave defaults

**Networking tab:**
- **Network access:** Public endpoint (all networks)

4. Click **Review + create** → **Create**

### Create Container:
1. After deployment, go to your new storage account
2. Left menu → **Containers**
3. Click **+ Container**
4. **Name:** `uploads`
5. **Public access level:** Private
6. Click **Create**

---

## Step 5: Copy Files from Old Storage to New Storage

### Using Azure Storage Explorer (Easiest):

**Install:**
- Download: https://azure.microsoft.com/features/storage-explorer/
- Install and launch
- Sign in with your Azure account

**Download from old storage:**
1. Navigate to OLD storage account → `uploads` container
2. Select all files (Ctrl+A)
3. Click **Download**
4. Save to: `C:\Medical App\blob-backup\`

**Upload to new storage:**
1. Navigate to NEW storage account → `uploads` container
2. Click **Upload** → **Upload Files**
3. Select all files from: `C:\Medical App\blob-backup\`
4. Click **Upload**

---

## Step 6: Update Cloned App Configuration

1. Go to your **CLONED** App Service in Azure Portal
2. Left menu → **Configuration**
3. Click **Application settings** tab

### Update These Settings:

**A. DATABASE_URL**
- Click on the `DATABASE_URL` setting
- Update value to your NEW connection string:
```
postgresql://surgicaladmin:[NEW-PASSWORD]@surgical-db-new.postgres.database.azure.com:5432/surgicaldb?sslmode=require
```
- Click **OK**

**B. AZURE_STORAGE_CONNECTION**
- Go to your NEW storage account → **Access keys**
- Copy **Connection string**
- Update the `AZURE_STORAGE_CONNECTION` setting with this value
- Click **OK**

**C. AZURE_STORAGE_ACCOUNT_NAME**
- Update value to: `surgicalstoragenew` (your new storage account name)
- Click **OK**

4. Click **Save** at the top
5. Click **Continue** when prompted about restart

---

## Step 7: Test Your Cloned App

1. Go to your cloned App Service → **Overview**
2. Click the **URL** (e.g., `https://surgical-backend-clone.azurewebsites.net`)

### Test Checklist:

```
□ Login page loads
□ Can login with: admin@example.com / admin123
□ Can see surgical forms list (should show old data)
□ Can view a form with uploaded file
□ Can download a form file (tests blob storage)
□ Can create a new form with file upload
□ User management works
□ Call hours page loads
```

**If all tests pass: ✅ Migration complete!**

---

## 🆘 Troubleshooting

### Database connection errors:
1. Check firewall rules on PostgreSQL server
2. Verify connection string is correct (especially password)
3. Make sure database name is `surgicaldb`

### File upload/download errors:
1. Check storage connection string is correct
2. Verify `uploads` container exists
3. Check container has files in Azure Portal

### App not starting:
1. Check App Service logs: Configuration → **Log stream**
2. Restart app: Overview → **Restart**
3. Verify all environment variables are set

---

## ✅ Final Checklist

After completing all steps:

```
□ New PostgreSQL server created
□ New database created and data imported
□ New storage account created
□ Files uploaded to new storage
□ App configuration updated
□ App tested and working
□ Old data visible in new app
□ File uploads/downloads working
```

**🎉 Congratulations! Your app is now cloned and running independently!**

---

## 💡 Optional: Update GitHub Actions

If you want to deploy updates to the NEW cloned app:

1. Get new publish profile:
   - Cloned App Service → **Deployment** → **Download publish profile**

2. Update GitHub Secrets:
   - Go to: https://github.com/Payo25/APP-VENDE-HUMO/settings/secrets/actions
   - Create new secret: `AZURE_WEBAPP_PUBLISH_PROFILE_CLONE`
   - Paste the publish profile XML

3. Update workflow file to use new secret when deploying

---

## 📞 Need Help?

If you get stuck:
1. Check Azure Portal logs (App Service → Log stream)
2. Verify each connection string is correct
3. Make sure all firewall rules allow access
4. Restart the App Service after configuration changes

Good luck! 🚀
