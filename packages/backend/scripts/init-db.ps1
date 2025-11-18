# PowerShell script to initialize PostgreSQL database
# Make sure PostgreSQL is installed and psql is in PATH

$env:PGPASSWORD = "Raptor-12345"

Write-Host "Creating database ruscord..." -ForegroundColor Green

# Create database (connect to default postgres database first)
psql -U postgres -h localhost -c "CREATE DATABASE ruscord;" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database 'ruscord' created successfully!" -ForegroundColor Green
} else {
    Write-Host "Database might already exist or there was an error. Continuing..." -ForegroundColor Yellow
}

Write-Host "Database initialization complete!" -ForegroundColor Green

