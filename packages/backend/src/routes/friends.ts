import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { query } from "../database";
import { z } from "zod";
import { getClients } from "../websocket";

const router = Router();
router.use(authenticate);

const addFriendSchema = z.object({
  username: z.string().min(2).max(32),
  discriminator: z.string().length(4),
});

// Get friends list
router.get("/", async (req: AuthRequest, res) => {
  try {
    const clients = getClients();
    const result = await query(
      `SELECT f.*, 
              u.id as friend_user_id,
              u.username as friend_username,
              u.discriminator as friend_discriminator,
              u.avatar as friend_avatar,
              u.status as friend_status
       FROM friends f
       INNER JOIN users u ON (
         CASE 
           WHEN f.user_id = $1 THEN f.friend_id
           ELSE f.user_id
         END = u.id
       )
       WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
       ORDER BY u.username ASC`,
      [req.userId]
    );

    const friends = result.rows.map((row: any) => {
      // Check if friend is actually connected via WebSocket
      const friendClient = clients?.get(row.friend_user_id);
      const isConnected = friendClient && friendClient.readyState === 1; // WebSocket.OPEN
      
      // If friend is connected, they are online (regardless of DB status)
      // If not connected, use DB status (which should be offline if they disconnected properly)
      let actualStatus = row.friend_status;
      if (isConnected && row.friend_status === "offline") {
        actualStatus = "online";
      } else if (!isConnected && row.friend_status !== "offline") {
        // If they're not connected but DB says online, they're actually offline
        actualStatus = "offline";
      }

      return {
        id: row.friend_user_id,
        username: row.friend_username,
        discriminator: row.friend_discriminator,
        avatar: row.friend_avatar,
        status: actualStatus,
        friendshipId: row.id,
        createdAt: row.created_at,
      };
    });

    res.json(friends);
  } catch (error) {
    console.error("Get friends error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get pending friend requests (sent and received)
router.get("/requests", async (req: AuthRequest, res) => {
  try {
    // Sent requests
    const sentResult = await query(
      `SELECT f.*, u.username, u.discriminator, u.avatar, u.status
       FROM friends f
       INNER JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.userId]
    );

    // Received requests
    const receivedResult = await query(
      `SELECT f.*, u.username, u.discriminator, u.avatar, u.status
       FROM friends f
       INNER JOIN users u ON f.user_id = u.id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.userId]
    );

    res.json({
      sent: sentResult.rows.map((row: any) => ({
        id: row.id,
        user: {
          id: row.friend_id,
          username: row.username,
          discriminator: row.discriminator,
          avatar: row.avatar,
          status: row.status,
        },
        createdAt: row.created_at,
      })),
      received: receivedResult.rows.map((row: any) => ({
        id: row.id,
        user: {
          id: row.user_id,
          username: row.username,
          discriminator: row.discriminator,
          avatar: row.avatar,
          status: row.status,
        },
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Get friend requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send friend request
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { username, discriminator } = addFriendSchema.parse(req.body);

    // Find user by username and discriminator
    const userResult = await query(
      "SELECT id FROM users WHERE username = $1 AND discriminator = $2",
      [username, discriminator]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const friendId = userResult.rows[0].id;

    if (friendId === req.userId) {
      return res.status(400).json({ error: "Нельзя добавить себя в друзья" });
    }

    // Check if already friends or request exists
    const existingResult = await query(
      `SELECT * FROM friends 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.userId, friendId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.status === "accepted") {
        return res.status(400).json({ error: "Уже в друзьях" });
      }
      if (existing.status === "pending") {
        return res.status(400).json({ error: "Запрос уже отправлен" });
      }
    }

    // Create friend request
    const result = await query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [req.userId, friendId]
    );

    // Get friend info
    const friendInfo = await query(
      "SELECT id, username, discriminator, avatar, status FROM users WHERE id = $1",
      [friendId]
    );

    // Get sender info for notification
    const senderInfo = await query(
      "SELECT id, username, discriminator, avatar FROM users WHERE id = $1",
      [req.userId]
    );

    // Send WebSocket notification to target user
    // Import getClients from websocket module
    const { getClients } = require("../websocket");
    const clients = getClients();
    const targetClient = clients.get(friendId);
    
    if (targetClient && targetClient.readyState === 1) { // WebSocket.OPEN
      targetClient.send(
        JSON.stringify({
          op: 0, // DISPATCH
          t: "FRIEND_REQUEST",
          d: {
            id: result.rows[0].id,
            user: senderInfo.rows[0],
            createdAt: result.rows[0].created_at,
          },
        })
      );
    }

    res.status(201).json({
      id: result.rows[0].id,
      user: friendInfo.rows[0],
      status: "pending",
      createdAt: result.rows[0].created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Add friend error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept friend request
router.post("/:id/accept", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if request exists and is pending
    const requestResult = await query(
      "SELECT * FROM friends WHERE id = $1 AND friend_id = $2 AND status = 'pending'",
      [id, req.userId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: "Запрос не найден" });
    }

    // Accept request
    await query(
      "UPDATE friends SET status = 'accepted', updated_at = NOW() WHERE id = $1",
      [id]
    );

    // Get friend info
    const friendResult = await query(
      `SELECT u.id, u.username, u.discriminator, u.avatar, u.status
       FROM friends f
       INNER JOIN users u ON f.user_id = u.id
       WHERE f.id = $1`,
      [id]
    );

    res.json({
      id: friendResult.rows[0].id,
      username: friendResult.rows[0].username,
      discriminator: friendResult.rows[0].discriminator,
      avatar: friendResult.rows[0].avatar,
      status: friendResult.rows[0].status,
    });
  } catch (error) {
    console.error("Accept friend request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reject/Remove friend
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if friendship exists
    const friendshipResult = await query(
      "SELECT * FROM friends WHERE id = $1 AND (user_id = $2 OR friend_id = $2)",
      [id, req.userId]
    );

    if (friendshipResult.rows.length === 0) {
      return res.status(404).json({ error: "Запрос не найден" });
    }

    // Delete friendship
    await query("DELETE FROM friends WHERE id = $1", [id]);

    res.status(204).send();
  } catch (error) {
    console.error("Remove friend error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search users by username
router.get("/search", async (req: AuthRequest, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.length < 2) {
      return res.status(400).json({ error: "Минимум 2 символа для поиска" });
    }

    const result = await query(
      `SELECT id, username, discriminator, avatar, status
       FROM users
       WHERE (username ILIKE $1 OR username || '#' || discriminator ILIKE $1)
       AND id != $2
       LIMIT 20`,
      [`%${q}%`, req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as friendRoutes };

