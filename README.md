# Ruscord

A Discord clone - Phase 1: Exact functional replica.

## Project Structure

```
ruscord/
├── packages/
│   ├── backend/          # Node.js/TypeScript backend server
│   ├── frontend/         # React/TypeScript frontend application
│   └── shared/           # Shared TypeScript types and utilities
├── package.json          # Root package.json with workspaces
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- npm

### Installation

1. Install dependencies:
```bash
npm run install:all
```

2. Setup PostgreSQL database:

   **Option A: Using psql command line:**
   ```powershell
   $env:PGPASSWORD = "Raptor-12345"
   psql -U postgres -h localhost -c "CREATE DATABASE ruscord;"
   ```

   **Option B: Using pgAdmin:**
   - Open pgAdmin
   - Connect to PostgreSQL server
   - Right-click "Databases" → "Create" → "Database"
   - Name: `ruscord`
   - Click "Save"

   See `packages/backend/scripts/setup-database.md` for detailed instructions.

3. Configure backend environment:
   
   The `.env` file has been created automatically with the following settings:
   - Database: `ruscord`
   - User: `postgres`
   - Password: `Raptor-12345`
   - JWT Secret: auto-generated
   
   If you need to modify settings, edit `packages/backend/.env`

### Development

```bash
# Run both backend and frontend
npm run dev

# Or run separately
npm run dev:backend
npm run dev:frontend
```

Backend will run on `http://localhost:3002`
Frontend will run on `http://localhost:3000`

## Features (Phase 1)

- ✅ User Authentication (Register/Login)
- ✅ Servers and Channels
- ✅ Text Channels with real-time messaging
- ✅ Voice Channels (structure ready)
- ✅ Direct Messages (structure ready)
- ✅ WebSocket real-time communication
- ✅ Server invites
- 🔄 Roles and Permissions (structure ready)
- 🔄 Voice Communication (WebRTC) - TODO
- 🔄 Screen Sharing - TODO
- 🔄 Rich Media Support - TODO

