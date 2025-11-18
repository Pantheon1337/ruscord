import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { query } from "../database";
import { randomBytes } from "crypto";

const router = Router();
router.use(authenticate);

// Create invite
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { serverId, channelId, maxUses, maxAge } = req.body;

    // Check if user is member
    const memberCheck = await query(
      "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
      [req.userId, serverId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this server" });
    }

    // Generate unique code
    const code = randomBytes(8).toString("base64url").substring(0, 8);

    let expiresAt = null;
    if (maxAge) {
      expiresAt = new Date(Date.now() + maxAge * 1000);
    }

    const result = await query(
      `INSERT INTO invites (code, server_id, channel_id, inviter_id, max_uses, max_age, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, serverId, channelId, req.userId, maxUses || null, maxAge || null, expiresAt]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get invite by code
router.get("/:code", async (req: AuthRequest, res) => {
  try {
    const { code } = req.params;

    const result = await query(
      `SELECT i.*, s.name as server_name, s.icon as server_icon,
              c.name as channel_name, u.username as inviter_username
       FROM invites i
       INNER JOIN servers s ON i.server_id = s.id
       INNER JOIN channels c ON i.channel_id = c.id
       INNER JOIN users u ON i.inviter_id = u.id
       WHERE i.code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invite not found" });
    }

    const invite = result.rows[0];

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: "Invite expired" });
    }

    // Check max uses
    if (invite.max_uses && invite.uses >= invite.max_uses) {
      return res.status(410).json({ error: "Invite has reached max uses" });
    }

    res.json(invite);
  } catch (error) {
    console.error("Get invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept invite
router.post("/:code/accept", async (req: AuthRequest, res) => {
  try {
    const { code } = req.params;

    const inviteResult = await query(
      "SELECT * FROM invites WHERE code = $1",
      [code]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: "Invite not found" });
    }

    const invite = inviteResult.rows[0];

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: "Invite expired" });
    }

    // Check max uses
    if (invite.max_uses && invite.uses >= invite.max_uses) {
      return res.status(410).json({ error: "Invite has reached max uses" });
    }

    // Check if already member
    const memberCheck = await query(
      "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
      [req.userId, invite.server_id]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: "Already a member" });
    }

    // Add member
    await query(
      "INSERT INTO members (user_id, server_id) VALUES ($1, $2)",
      [req.userId, invite.server_id]
    );

    // Update invite uses
    await query(
      "UPDATE invites SET uses = uses + 1 WHERE code = $1",
      [code]
    );

    // Get server info
    const serverResult = await query(
      "SELECT * FROM servers WHERE id = $1",
      [invite.server_id]
    );

    res.json(serverResult.rows[0]);
  } catch (error) {
    console.error("Accept invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as inviteRoutes };

