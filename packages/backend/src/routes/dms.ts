import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { query } from "../database";
import { getClients } from "../websocket";

const router = Router();
router.use(authenticate);

// Get user's DM channels
router.get("/", async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT dm.id, dm.type, dm.created_at, dm.updated_at
       FROM dm_channels dm
       INNER JOIN dm_participants dp ON dm.id = dp.channel_id
       WHERE dp.user_id = $1
       GROUP BY dm.id, dm.type, dm.created_at, dm.updated_at
       ORDER BY COALESCE(dm.updated_at, dm.created_at) DESC`,
      [req.userId]
    );

    // Get recipients for each DM channel
    const clients = getClients();
    const channelsWithRecipients = await Promise.all(
      result.rows.map(async (dm: any) => {
        const recipientsResult = await query(
          `SELECT u.id, u.username, u.discriminator, u.avatar, u.status
           FROM dm_participants dp
           INNER JOIN users u ON dp.user_id = u.id
           WHERE dp.channel_id = $1 AND dp.user_id != $2`,
          [dm.id, req.userId]
        );

        // Update recipient status based on actual WebSocket connection
        const recipients = recipientsResult.rows.map((recipient: any) => {
          const recipientClient = clients?.get(recipient.id);
          const isConnected = recipientClient && recipientClient.readyState === 1; // WebSocket.OPEN
          
          let actualStatus = recipient.status || "offline";
          if (isConnected && actualStatus === "offline") {
            actualStatus = "online";
          } else if (!isConnected && actualStatus !== "offline") {
            actualStatus = "offline";
          }

          return {
            ...recipient,
            status: actualStatus,
          };
        });

        return {
          ...dm,
          recipients: recipients,
        };
      })
    );

    res.json(channelsWithRecipients);
  } catch (error) {
    console.error("Get DMs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create or get DM channel
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;

    if (!userId || userId === req.userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Check if DM channel already exists
    const existingResult = await query(
      `SELECT dm.* FROM dm_channels dm
       INNER JOIN dm_participants dp1 ON dm.id = dp1.channel_id
       INNER JOIN dm_participants dp2 ON dm.id = dp2.channel_id
       WHERE dp1.user_id = $1 AND dp2.user_id = $2 AND dm.type = 'DM'`,
      [req.userId, userId]
    );

    if (existingResult.rows.length > 0) {
      const existingChannel = existingResult.rows[0];
      // Get recipients for existing channel
      const clients = getClients();
      const recipientsResult = await query(
        `SELECT u.id, u.username, u.discriminator, u.avatar, u.status
         FROM dm_participants dp
         INNER JOIN users u ON dp.user_id = u.id
         WHERE dp.channel_id = $1 AND dp.user_id != $2`,
        [existingChannel.id, req.userId]
      );
      
      // Update recipient status based on actual WebSocket connection
      const recipients = recipientsResult.rows.map((recipient: any) => {
        const recipientClient = clients?.get(recipient.id);
        const isConnected = recipientClient && recipientClient.readyState === 1; // WebSocket.OPEN
        
        let actualStatus = recipient.status || "offline";
        if (isConnected && actualStatus === "offline") {
          actualStatus = "online";
        } else if (!isConnected && actualStatus !== "offline") {
          actualStatus = "offline";
        }

        return {
          ...recipient,
          status: actualStatus,
        };
      });
      
      return res.json({
        ...existingChannel,
        recipients: recipients,
      });
    }

    // Create new DM channel
    const channelResult = await query(
      `INSERT INTO dm_channels (type)
       VALUES ('DM')
       RETURNING *`,
      []
    );

    const channel = channelResult.rows[0];

    // Add participants
    await query(
      "INSERT INTO dm_participants (channel_id, user_id) VALUES ($1, $2), ($1, $3)",
      [channel.id, req.userId, userId]
    );

    // Create corresponding channel entry for messages
    await query(
      `INSERT INTO channels (id, name, type)
       VALUES ($1, 'DM', 'DM')`,
      [channel.id]
    );

    // Get friend info for response
    const clients = getClients();
    const friendInfo = await query(
      "SELECT id, username, discriminator, avatar, status FROM users WHERE id = $1",
      [userId]
    );

    // Update recipient status based on actual WebSocket connection
    const recipients = friendInfo.rows.map((recipient: any) => {
      const recipientClient = clients?.get(recipient.id);
      const isConnected = recipientClient && recipientClient.readyState === 1; // WebSocket.OPEN
      
      let actualStatus = recipient.status || "offline";
      if (isConnected && actualStatus === "offline") {
        actualStatus = "online";
      } else if (!isConnected && actualStatus !== "offline") {
        actualStatus = "offline";
      }

      return {
        ...recipient,
        status: actualStatus,
      };
    });

    res.status(201).json({
      ...channel,
      recipients: recipients,
    });
  } catch (error) {
    console.error("Create DM error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as dmRoutes };

