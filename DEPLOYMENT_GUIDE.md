# 🚀 Azure Deployment Guide - Manual Steps

Due to Azure CLI connection issues, follow these steps to configure and deploy your app:

## Step 1: Configure Azure App Service Settings (Azure Portal)

1. **Go to Azure Portal**: https://portal.azure.com
2. Navigate to **App Services** → `surgical-backend-new`
3. In the left menu, click **Configuration** → **Application settings**
4. Click **+ New application setting** and add each of these:

### Required Settings:

| Name | Value |
|------|-------|
| `DATABASE_URL` | `postgresql://surgicaladmin:Alondra2633658$@surgical-db-new.postgres.database.azure.com:5432/postgres?sslmode=require` |
| `AZURE_STORAGE_CONNECTION` | `DefaultEndpointsProtocol=https;AccountName=surgicalstorage2025;AccountKey=YOUR_STORAGE_KEY_HERE;EndpointSuffix=core.windows.net` |
| `AZURE_STORAGE_ACCOUNT_NAME` | `surgicalstorage2025` |
| `AZURE_STORAGE_CONTAINER_NAME` | `uploads` |
| `NODE_ENV` | `production` |

5. Click **Save** at the top
6. Click **Continue** when prompted to restart the app

---

## Step 2: Deploy via GitHub Actions

Your app is already configured for automatic deployment via GitHub Actions. Just push your code:

```powershell
cd "c:\Medical App\surgical-forms-app-main"

# Add all changes
git add .

# Commit
git commit -m "Configure Azure deployment settings"

# Push to trigger deployment
git push origin main
```

---

## Step 3: Monitor Deployment

1. **GitHub Actions**: https://github.com/Payo25/APP-VENDE-HUMO/actions
   - Watch the "Build and deploy Node.js app to Azure Web App" workflow
   - Deployment takes about 3-5 minutes

2. **Azure Portal**: https://portal.azure.com
   - App Service → `surgical-backend-new` → **Deployment Center**
   - Check deployment logs

---

## Step 4: Verify Deployment

Once deployment completes:

1. **Visit your app**: https://surgical-backend-new.azurewebsites.net

2. **Test health endpoint**: https://surgical-backend-new.azurewebsites.net/api/health
   - Should return: `{"status":"ok", ...}`

3. **Login to app**:
   - Email: `admin@example.com`
   - Password: `admin123`

---

## Quick Deploy Commands

If you just want to deploy now:

```powershell
# Navigate to project
cd "c:\Medical App\surgical-forms-app-main"

# Make sure backend/build exists (frontend build)
if (!(Test-Path "backend\build")) {
    Write-Host "Building frontend..."
    cd frontend
    npm run build
    cd ..
    Copy-Item -Path "frontend\build" -Destination "backend\build" -Recurse
}

# Add and commit changes
git add frontend/package.json .env.example *.md *.ps1
git commit -m "Deploy to Azure"

# Push (triggers automatic deployment)
git push origin main
```

---

## Troubleshooting

### Deployment fails?
1. Check GitHub Actions logs for errors
2. Verify App Service configuration in Azure Portal
3. Check Application Insights or Log Stream in Azure Portal

### App not loading?
1. Check App Service → **Log stream** for errors
2. Verify environment variables are set correctly
3. Check database firewall rules include Azure services

### Database connection issues?
1. Azure Portal → PostgreSQL → **Networking**
2. Ensure "Allow public access from any Azure service" is enabled
3. Or add your Azure App Service outbound IPs to firewall

---

## Alternative: Use Azure Portal Deployment

If GitHub Actions isn't working:

1. **Build locally**:
   ```powershell
   cd "c:\Medical App\surgical-forms-app-main\frontend"
   npm run build
   cd ..\backend
   Copy-Item -Path "..\frontend\build" -Destination "build" -Recurse
   ```

2. **Zip backend folder**:
   ```powershell
   Compress-Archive -Path "c:\Medical App\surgical-forms-app-main\backend\*" -DestinationPath "c:\Medical App\surgical-forms-app-deploy.zip" -Force
   ```

3. **Deploy via Kudu**:
   - Go to: https://surgical-backend-new.scm.azurewebsites.net/ZipDeployUI
   - Drag and drop the ZIP file
   - Wait for deployment to complete

---

## Post-Deployment

After successful deployment:

- ✅ App URL: https://surgical-backend-new.azurewebsites.net
- ✅ Health check: https://surgical-backend-new.azurewebsites.net/api/health
- ✅ Login: admin@example.com / admin123

**Important**: The first request after deployment may be slow (cold start). Wait 10-15 seconds.

---

## Continuous Deployment

Your app is now configured for automatic deployment:
- Every push to `main` branch triggers deployment
- GitHub Actions handles build and deploy
- No manual steps needed after initial setup

Happy deploying! 🎉
