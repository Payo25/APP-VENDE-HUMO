# Simplified Migration Guide - Cross-Account PostgreSQL Migration

Since the Azure Migration wizard won't work for Flexible Server to Flexible Server cross-account migration, here are alternative approaches:

## 🎯 **RECOMMENDED: Use Azure Data Studio**

This is the easiest GUI method without command-line tools.

### Step 1: Install Azure Data Studio
Download from: https://aka.ms/azuredatastudio

### Step 2: Connect to OLD Database
1. Open Azure Data Studio
2. Click "New Connection"
3. Fill in:
   - **Server**: `surgical-db-server.postgres.database.azure.com`
   - **Authentication type**: SQL Login
   - **User name**: `surgical_admin`
   - **Password**: `Alondra2633658$`
   - **Database**: `surgical_forms`
4. Click "Connect"

### Step 3: Export Database
1. Right-click on database → **"Tasks"** → **"Extract"** or **"Backup"**
2. Save to: `C:\Medical App\surgical_backup.sql`

### Step 4: Connect to NEW Database
1. Click "New Connection" again
2. Fill in:
   - **Server**: `surgical-db-new.postgres.database.azure.com`
   - **Authentication type**: SQL Login
   - **User name**: `surgicaladmin`
   - **Password**: [your new password]
   - **Database**: `surgical_forms` (create if doesn't exist)
4. Click "Connect"

### Step 5: Import to NEW Database
1. Right-click on NEW database → **"Restore"**
2. Select the backup file: `C:\Medical App\surgical_backup.sql`
3. Run restore

---

## 🎯 **ALTERNATIVE: Quick Start with Shared Database**

If you need the app working NOW, temporarily use the same database:

### In your CLONED app (`surgical-forms-new`):

Go to Configuration → Application settings:

```
DATABASE_URL = postgresql://surgical_admin:Alondra2633658$@surgical-db-server.postgres.database.azure.com:5432/surgical_forms?sslmode=require

AZURE_STORAGE_CONNECTION = [your old storage connection string]

AZURE_STORAGE_ACCOUNT_NAME = surgicalformstorage
```

**Pros:**
- ✅ Works immediately
- ✅ No migration needed
- ✅ Can migrate data later

**Cons:**
- ⚠️ Both apps share same data
- ⚠️ Changes in one affect the other

---

## 📋 Which Option Do You Want?

1. **Azure Data Studio** (takes 30 min, full separation)
2. **Shared Database** (works in 5 min, migrate later)
3. **Try another export method**

Let me know and I'll guide you through it!
