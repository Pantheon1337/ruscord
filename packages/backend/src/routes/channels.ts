import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { query } from "../database";
import { z } from "zod";

const router = Router();
router.use(authenticate);

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["TEXT", "VOICE"]),
  position: z.number().optional(),
});

// Get channel by ID
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query("SELECT * FROM channels WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const channel = result.rows[0];

    // Check permissions if server channel
    if (channel.server_id) {
      const memberCheck = await query(
        "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
        [req.userId, channel.server_id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    res.json(channel);
  } catch (error) {
    console.error("Get channel error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create channel
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, type, position, serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({ error: "serverId is required" });
    }

    // Check if user is member and has permission
    const memberCheck = await query(
      "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
      [req.userId, serverId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this server" });
    }

    // Get max position
    const positionResult = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM channels WHERE server_id = $1",
      [serverId]
    );

    const nextPosition =
      position !== undefined ? position : positionResult.rows[0].next_position;

    const result = await query(
      `INSERT INTO channels (server_id, name, type, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [serverId, name, type, nextPosition]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create channel error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update channel
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, position } = req.body;

    // Check permissions
    const channelResult = await query("SELECT * FROM channels WHERE id = $1", [
      id,
    ]);

    if (channelResult.rows.length === 0) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const channel = channelResult.rows[0];

    if (channel.server_id) {
      const memberCheck = await query(
        "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
        [req.userId, channel.server_id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (position !== undefined) {
      updates.push(`position = $${paramCount++}`);
      values.push(position);
    }

    if (updates.length === 0) {
      return res.json(channel);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE channels SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update channel error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete channel
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check permissions
    const channelResult = await query("SELECT * FROM channels WHERE id = $1", [
      id,
    ]);

    if (channelResult.rows.length === 0) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const channel = channelResult.rows[0];

    if (channel.server_id) {
      const memberCheck = await query(
        "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
        [req.userId, channel.server_id]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    await query("DELETE FROM channels WHERE id = $1", [id]);

    res.status(204).send();
  } catch (error) {
    console.error("Delete channel error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as channelRoutes };

