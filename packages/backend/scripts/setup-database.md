# Database Setup Instructions

## Prerequisites
- PostgreSQL installed and running
- psql command available in PATH (or use full path to psql.exe)

## Option 1: Using psql command line

1. Open PowerShell or Command Prompt
2. Set PostgreSQL password environment variable:
   ```powershell
   $env:PGPASSWORD = "Raptor-12345"
   ```

3. Create the database:
   ```powershell
   psql -U postgres -h localhost -c "CREATE DATABASE ruscord;"
   ```

   Or if psql is not in PATH, use full path:
   ```powershell
   & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE ruscord;"
   ```

## Option 2: Using pgAdmin

1. Open pgAdmin
2. Connect to PostgreSQL server
3. Right-click on "Databases" → "Create" → "Database"
4. Name: `ruscord`
5. Click "Save"

## Option 3: Using SQL script

1. Connect to PostgreSQL as postgres user
2. Run the SQL script:
   ```sql
   CREATE DATABASE ruscord;
   ```

## Verify Database Creation

```powershell
psql -U postgres -h localhost -l | Select-String "ruscord"
```

## After Database Creation

The application will automatically create all necessary tables when you start the backend server for the first time. The schema is defined in `src/database/schema.ts`.

