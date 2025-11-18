# Script to check PostgreSQL connection and database
param(
    [string]$Password = "Raptor-12345",
    [string]$User = "postgres",
    [string]$Host = "localhost",
    [string]$Database = "ruscord"
)

Write-Host "=== Checking PostgreSQL Connection ===" -ForegroundColor Cyan
Write-Host ""

# Try to find psql
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
    Write-Host "❌ psql not found. Please install PostgreSQL or add it to PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "Checking if PostgreSQL service is running..." -ForegroundColor Yellow
    $pgService = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue
    if ($pgService) {
        Write-Host "Found PostgreSQL services:" -ForegroundColor Yellow
        $pgService | Format-Table Name, Status
    } else {
        Write-Host "No PostgreSQL services found." -ForegroundColor Red
    }
    exit 1
}

Write-Host "Found psql at: $psql" -ForegroundColor Green
Write-Host ""

# Set password
$env:PGPASSWORD = $Password

# Check connection
Write-Host "Testing connection to PostgreSQL..." -ForegroundColor Yellow
$testResult = & $psql -U $User -h $Host -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL connection successful!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "❌ Cannot connect to PostgreSQL:" -ForegroundColor Red
    Write-Host $testResult -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. PostgreSQL service is running" -ForegroundColor Yellow
    Write-Host "  2. PostgreSQL is listening on port 5432" -ForegroundColor Yellow
    Write-Host "  3. Password is correct: $Password" -ForegroundColor Yellow
    exit 1
}

# Check if database exists
Write-Host "Checking if database '$Database' exists..." -ForegroundColor Yellow
$dbCheck = & $psql -U $User -h $Host -tAc "SELECT 1 FROM pg_database WHERE datname='$Database'" 2>&1

if ($dbCheck -match "1") {
    Write-Host "✅ Database '$Database' exists!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Database '$Database' does not exist." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Creating database..." -ForegroundColor Yellow
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
Write-Host "✅ All checks passed! Database is ready." -ForegroundColor Green

