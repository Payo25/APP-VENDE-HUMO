# Export Database Script
# This script exports your OLD surgical_forms database to a backup file

Write-Host "🔄 Starting database export..." -ForegroundColor Cyan

# Connection details
$SERVER = "surgical-db-server.postgres.database.azure.com"
$DATABASE = "surgical_forms"
$USERNAME = "surgical_admin"
$PASSWORD = "Alondra2633658$"
$BACKUP_FILE = "C:\Medical App\surgical_backup_$(Get-Date -Format 'yyyy-MM-dd_HHmm').sql"

# Set password as environment variable (pg_dump will use it)
$env:PGPASSWORD = $PASSWORD

Write-Host "📦 Exporting database to: $BACKUP_FILE" -ForegroundColor Yellow

# Try to find pg_dump in common locations
$pgDumpPaths = @(
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "pg_dump"  # Try system PATH
)

$pgDumpCmd = $null
foreach ($path in $pgDumpPaths) {
    if (Test-Path $path -ErrorAction SilentlyContinue) {
        $pgDumpCmd = $path
        break
    }
}

if ($null -eq $pgDumpCmd) {
    # Try to run pg_dump from PATH
    try {
        $null = Get-Command pg_dump -ErrorAction Stop
        $pgDumpCmd = "pg_dump"
    } catch {
        Write-Host "" -ForegroundColor Red
        Write-Host "❌ ERROR: pg_dump not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install PostgreSQL client tools:" -ForegroundColor Yellow
        Write-Host "1. Download from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor Cyan
        Write-Host "2. Install PostgreSQL 15 for Windows" -ForegroundColor Cyan
        Write-Host "3. During installation, select 'Command Line Tools'" -ForegroundColor Cyan
        Write-Host "4. Run this script again" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
}

Write-Host "✅ Found pg_dump at: $pgDumpCmd" -ForegroundColor Green

# Run the export
& $pgDumpCmd `
    --host=$SERVER `
    --port=5432 `
    --username=$USERNAME `
    --dbname=$DATABASE `
    --no-password `
    --clean `
    --if-exists `
    --verbose `
    --file="$BACKUP_FILE"

# Clear password from environment
$env:PGPASSWORD = $null

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ SUCCESS! Database exported to:" -ForegroundColor Green
    Write-Host "   $BACKUP_FILE" -ForegroundColor Cyan
    Write-Host ""
    $fileSize = (Get-Item $BACKUP_FILE).Length / 1MB
    Write-Host "📊 File size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next step: Import this file to your NEW database!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Export failed with error code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host ""
}
