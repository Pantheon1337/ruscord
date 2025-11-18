import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import { setupRoutes } from "./routes";
import { setupWebSocket } from "./websocket";
import { initDatabase } from "./database";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
import path from "path";
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Initialize database
initDatabase()
  .then(() => {
    console.log("Database initialized");

    // Setup routes
    setupRoutes(app);

    // Create HTTP server
    const server = createServer(app);

    // Setup WebSocket server
    const wss = new WebSocketServer({ server });
    setupWebSocket(wss);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server running on port ${PORT}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please close the process using this port and try again.`);
        console.error(`You can find the process using: netstat -ano | findstr ":${PORT}"`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });

