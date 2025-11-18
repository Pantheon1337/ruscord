import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { query } from "../database";
import { z } from "zod";
import { uploadServerIcon } from "../middleware/upload";

const router = Router();
router.use(authenticate);

const createServerSchema = z.object({
  name: z.string().min(1).max(100),
});

// Get user's servers
router.get("/", async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT s.* FROM servers s
       INNER JOIN members m ON s.id = m.server_id
       WHERE m.user_id = $1
       ORDER BY s.created_at ASC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get servers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create server
router.post("/", uploadServerIcon.single("icon"), async (req: AuthRequest, res) => {
  try {
    const { name } = createServerSchema.parse(req.body);
    
    // Get icon path if uploaded
    let iconPath: string | null = null;
    if (req.file) {
      iconPath = `/uploads/server-icons/${req.file.filename}`;
    }

    // Create server
    const serverResult = await query(
      `INSERT INTO servers (name, owner_id, icon)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, req.userId, iconPath]
    );

    const server = serverResult.rows[0];

    // Add owner as member
    const memberResult = await query(
      `INSERT INTO members (user_id, server_id)
       VALUES ($1, $2)
       RETURNING id`,
      [req.userId, server.id]
    );

    // Create default channels
    const generalChannel = await query(
      `INSERT INTO channels (server_id, name, type, position)
       VALUES ($1, 'general', 'TEXT', 0)
       RETURNING *`,
      [server.id]
    );

    const voiceChannel = await query(
      `INSERT INTO channels (server_id, name, type, position)
       VALUES ($1, 'General', 'VOICE', 1)
       RETURNING *`,
      [server.id]
    );

    // Create default @everyone role
    await query(
      `INSERT INTO roles (server_id, name, color, permissions, position)
       VALUES ($1, '@everyone', 0, 104324673, 0)`,
      [server.id]
    );

    res.status(201).json({
      ...server,
      channels: [generalChannel.rows[0], voiceChannel.rows[0]],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Create server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get server by ID
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user is member
    const memberCheck = await query(
      "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
      [req.userId, id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this server" });
    }

    const serverResult = await query("SELECT * FROM servers WHERE id = $1", [
      id,
    ]);

    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: "Server not found" });
    }

    // Get channels
    const channelsResult = await query(
      "SELECT * FROM channels WHERE server_id = $1 ORDER BY position ASC",
      [id]
    );

    // Get members
    const membersResult = await query(
      `SELECT m.*, u.username, u.discriminator, u.avatar, u.status
       FROM members m
       INNER JOIN users u ON m.user_id = u.id
       WHERE m.server_id = $1`,
      [id]
    );

    // Get roles
    const rolesResult = await query(
      "SELECT * FROM roles WHERE server_id = $1 ORDER BY position DESC",
      [id]
    );

    res.json({
      ...serverResult.rows[0],
      channels: channelsResult.rows,
      members: membersResult.rows,
      roles: rolesResult.rows,
    });
  } catch (error) {
    console.error("Get server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as serverRoutes };

