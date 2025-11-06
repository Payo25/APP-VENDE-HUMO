# Simple Database Export Script

Write-Host "🔄 Exporting OLD database..." -ForegroundColor Cyan

$SERVER = "surgical-db-server.postgres.database.azure.com"
$DATABASE = "surgical_forms"
$USERNAME = "surgical_admin"
$PASSWORD = "Alondra2633658$"
$BACKUP_FILE = "C:\Medical App\surgical_backup.sql"

$env:PGPASSWORD = $PASSWORD

Write-Host "📦 Saving to: $BACKUP_FILE" -ForegroundColor Yellow

# Check if pg_dump exists
$pgdump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgdump) {
    Write-Host "❌ pg_dump not found. Install PostgreSQL client tools from:" -ForegroundColor Red
    Write-Host "   https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor Cyan
    exit 1
}

pg_dump --host=$SERVER --port=5432 --username=$USERNAME --dbname=$DATABASE --no-password --clean --if-exists --verbose --file="$BACKUP_FILE"

$env:PGPASSWORD = $null

if (Test-Path $BACKUP_FILE) {
    $size = (Get-Item $BACKUP_FILE).Length / 1MB
    Write-Host ""
    Write-Host "✅ Export complete!" -ForegroundColor Green
    Write-Host "📁 File: $BACKUP_FILE" -ForegroundColor Cyan
    Write-Host "📊 Size: $([math]::Round($size, 2)) MB" -ForegroundColor Yellow
} else {
    Write-Host "❌ Export failed!" -ForegroundColor Red
}
