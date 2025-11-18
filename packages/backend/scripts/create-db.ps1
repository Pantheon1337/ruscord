# PowerShell script to create PostgreSQL database for Ruscord
# Usage: .\create-db.ps1

param(
    [string]$Password = "Raptor-12345",
    [string]$User = "postgres",
    [string]$Host = "localhost",
    [string]$Database = "ruscord"
)

Write-Host "=== Ruscord Database Setup ===" -ForegroundColor Cyan
Write-Host ""

# Try to find psql in common locations
$psqlPaths = @(
    "psql",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "C:\Program Files\PostgreSQL\13\bin\psql.exe",
    "C:\Program Files\PostgreSQL\12\bin\psql.exe"
)

$psql = $null
foreach ($path in $psqlPaths) {
    if ($path -eq "psql") {
        $psql = Get-Command psql -ErrorAction SilentlyContinue
        if ($psql) {
            $psql = $psql.Source
            break
        }
    } else {
        if (Test-Path $path) {
            $psql = $path
            break
        }
    }
}

if (-not $psql) {
    Write-Host "❌ Error: psql not found. Please install PostgreSQL or add it to PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "You can also create the database manually:" -ForegroundColor Yellow
    Write-Host "  1. Open pgAdmin" -ForegroundColor Yellow
    Write-Host "  2. Connect to PostgreSQL server" -ForegroundColor Yellow
    Write-Host "  3. Right-click 'Databases' → 'Create' → 'Database'" -ForegroundColor Yellow
    Write-Host "  4. Name: $Database" -ForegroundColor Yellow
    Write-Host "  5. Click 'Save'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found psql at: $psql" -ForegroundColor Green
Write-Host ""

# Set password environment variable
$env:PGPASSWORD = $Password

Write-Host "Creating database '$Database'..." -ForegroundColor Yellow

# Check if database already exists
$checkResult = & $psql -U $User -h $Host -tAc "SELECT 1 FROM pg_database WHERE datname='$Database'" 2>&1

if ($checkResult -match "1") {
    Write-Host "⚠️  Database '$Database' already exists. Skipping creation." -ForegroundColor Yellow
} else {
    # Create database
    $createResult = & $psql -U $User -h $Host -c "CREATE DATABASE $Database;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database '$Database' created successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Error creating database:" -ForegroundColor Red
        Write-Host $createResult -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "The application will automatically create all tables when you start the backend server." -ForegroundColor Cyan
Write-Host ""

