import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { query } from "../database";
import { z } from "zod";
import { getClients } from "../websocket";
import { broadcastToChannel } from "../websocket/handlers";

const router = Router();
router.use(authenticate);

const createMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

// Get messages for channel
router.get("/channel/:channelId", async (req: AuthRequest, res) => {
  try {
    const { channelId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string;

    // Check if it's a regular channel or DM channel
    let channelResult = await query("SELECT * FROM channels WHERE id = $1", [
      channelId,
    ]);

    let channel: any = null;
    let isDM = false;

    if (channelResult.rows.length > 0) {
      channel = channelResult.rows[0];
      // Check permissions for server channels
      if (channel.server_id) {
        const memberCheck = await query(
          "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
          [req.userId, channel.server_id]
        );

        if (memberCheck.rows.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    } else {
      // Check if it's a DM channel
      const dmChannelResult = await query(
        "SELECT * FROM dm_channels WHERE id = $1",
        [channelId]
      );

      if (dmChannelResult.rows.length === 0) {
        return res.status(404).json({ error: "Channel not found" });
      }

      isDM = true;
      channel = dmChannelResult.rows[0];

      // Check if user is participant in DM channel
      const participantCheck = await query(
        "SELECT user_id FROM dm_participants WHERE channel_id = $1 AND user_id = $2",
        [channelId, req.userId]
      );

      if (participantCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    let messagesQuery = `
      SELECT m.*, u.username, u.discriminator, u.avatar
      FROM messages m
      INNER JOIN users u ON m.author_id = u.id
      WHERE m.channel_id = $1
    `;

    const params: any[] = [channelId];

    if (before) {
      messagesQuery += ` AND m.id < $2`;
      params.push(before);
    }

    messagesQuery += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const messagesResult = await query(messagesQuery, params);

    // Get attachments for messages
    const messageIds = messagesResult.rows.map((m: any) => m.id);
    let attachments: any[] = [];

    if (messageIds.length > 0) {
      const attachmentsResult = await query(
        `SELECT * FROM attachments WHERE message_id = ANY($1)`,
        [messageIds]
      );
      attachments = attachmentsResult.rows;
    }

    // Get reactions
    let reactions: any[] = [];
    if (messageIds.length > 0) {
      const reactionsResult = await query(
        `SELECT message_id, emoji, array_agg(user_id) as user_ids
         FROM reactions
         WHERE message_id = ANY($1)
         GROUP BY message_id, emoji`,
        [messageIds]
      );
      reactions = reactionsResult.rows;
    }

    // Format messages
    const messages = messagesResult.rows.reverse().map((msg: any) => {
      const msgAttachments = attachments.filter((a) => a.message_id === msg.id);
      const msgReactions = reactions
        .filter((r) => r.message_id === msg.id)
        .map((r) => ({
          emoji: r.emoji,
          userIds: r.user_ids,
        }));

      return {
        id: msg.id,
        channelId: msg.channel_id,
        author: {
          id: msg.author_id,
          username: msg.username,
          discriminator: msg.discriminator,
          avatar: msg.avatar,
        },
        content: msg.content,
        attachments: msgAttachments,
        reactions: msgReactions,
        editedAt: msg.edited_at,
        createdAt: msg.created_at,
      };
    });

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create message
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { channelId, content } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: "channelId is required" });
    }

    // Check if it's a regular channel or DM channel
    let channelResult = await query("SELECT * FROM channels WHERE id = $1", [
      channelId,
    ]);

    let channel: any = null;
    let isDM = false;

    if (channelResult.rows.length > 0) {
      channel = channelResult.rows[0];
      // Check permissions for server channels
      if (channel.server_id) {
        const memberCheck = await query(
          "SELECT id FROM members WHERE user_id = $1 AND server_id = $2",
          [req.userId, channel.server_id]
        );

        if (memberCheck.rows.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    } else {
      // Check if it's a DM channel
      const dmChannelResult = await query(
        "SELECT * FROM dm_channels WHERE id = $1",
        [channelId]
      );

      if (dmChannelResult.rows.length === 0) {
        return res.status(404).json({ error: "Channel not found" });
      }

      isDM = true;
      channel = dmChannelResult.rows[0];

      // Check if user is participant in DM channel
      const participantCheck = await query(
        "SELECT user_id FROM dm_participants WHERE channel_id = $1 AND user_id = $2",
        [channelId, req.userId]
      );

      if (participantCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Create message
    const messageResult = await query(
      `INSERT INTO messages (channel_id, author_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [channelId, req.userId, content]
    );

    // Get author info
    const authorResult = await query(
      "SELECT username, discriminator, avatar FROM users WHERE id = $1",
      [req.userId]
    );

    const message = {
      id: messageResult.rows[0].id,
      channelId: messageResult.rows[0].channel_id,
      author: authorResult.rows[0],
      content: messageResult.rows[0].content,
      attachments: [],
      reactions: [],
      createdAt: messageResult.rows[0].created_at,
    };

    // Broadcast message via WebSocket
    const clients = getClients();
    if (clients) {
      await broadcastToChannel(channelId, "MESSAGE_CREATE", message, clients);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error("Create message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update message
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    // Check if message exists and user is author
    const messageResult = await query(
      "SELECT * FROM messages WHERE id = $1",
      [id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    const message = messageResult.rows[0];

    if (message.author_id !== req.userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await query(
      `UPDATE messages SET content = $1, edited_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [content, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete message
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if message exists
    const messageResult = await query(
      "SELECT * FROM messages WHERE id = $1",
      [id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    const message = messageResult.rows[0];

    // Check if user is author or has manage messages permission
    if (message.author_id !== req.userId) {
      // TODO: Check permissions
      return res.status(403).json({ error: "Not authorized" });
    }

    await query("DELETE FROM messages WHERE id = $1", [id]);

    res.status(204).send();
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as messageRoutes };

