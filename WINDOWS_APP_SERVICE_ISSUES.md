# Windows App Service iisnode Issues - Solutions

## Current Problem:
Your app is deployed to a **Windows App Service** using **iisnode**, which is having startup issues.

## Quick Fix Options:

### Option 1: Check Azure Portal Logs (Recommended First)
1. Go to: https://portal.azure.com
2. Navigate to: **App Services** → **surgical-backend-new**
3. Click: **Diagnose and solve problems** (left menu)
4. Search for: "Application Logs"
5. Check what the actual error is

### Option 2: Enable Application Insights
1. Go to App Service → **Application Insights**
2. Enable it to get detailed error logs
3. Check Live Metrics to see real-time errors

### Option 3: Manual Test via Kudu Console
1. Go to: https://surgical-backend-new-djb2b3ezgghsdnft.scm.centralus-01.azurewebsites.net
2. Click: **Debug Console** → **CMD**
3. Navigate to: `site\wwwroot`
4. Run: `node index.js` to see the actual error

### Option 4: Switch to Linux App Service (Best Long-term Solution)
Linux App Services are better for Node.js apps. Steps:

1. **Create new Linux App Service**:
```powershell
az webapp create `
  --resource-group surgical-form-rg `
  --plan surgical-form-rg `
  --name surgical-backend-linux `
  --runtime "NODE:20-lts" `
  --deployment-local-git
```

2. **Update GitHub Actions** to target the new app

3. **Migrate environment variables** from old to new app

## Most Likely Issues:

### 1. Missing node_modules
- iisnode might not be finding dependencies
- Solution: Ensure `node_modules` are included in deployment

### 2. Environment Variables Not Loaded
- Check if DATABASE_URL is actually set
- Go to Configuration → Application settings

### 3. Port Configuration
- Windows App Service expects app to listen on `process.env.PORT`
- Your app already does this (port 5043 locally, dynamic on Azure)

### 4. web.config Issues
- The web.config looks correct
- But iisnode might need additional configuration

## Immediate Action:

**Check Kudu Console (Option 3 above)** - This will show you the exact error message when running `node index.js` manually.

URL: https://surgical-backend-new-djb2b3ezgghsdnft.scm.centralus-01.azurewebsites.net

Once you see the actual error, we can fix it specifically!
