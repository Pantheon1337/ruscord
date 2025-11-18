import { WebSocket } from "ws";
import { GatewayOpcode } from "@ruscord/shared";
import { query } from "../database";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
}

export const handleWebSocketMessage = async (
  ws: AuthenticatedWebSocket,
  message: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  switch (message.op) {
    case GatewayOpcode.PRESENCE_UPDATE:
      await handlePresenceUpdate(ws, message.d, clients);
      break;

    case GatewayOpcode.VOICE_STATE_UPDATE:
      await handleVoiceStateUpdate(ws, message.d, clients);
      break;

    case GatewayOpcode.CALL_START:
      await handleCallStart(ws, message.d, clients);
      break;

    case GatewayOpcode.CALL_END:
      await handleCallEnd(ws, message.d, clients);
      break;

    case GatewayOpcode.CALL_OFFER:
      await handleCallOffer(ws, message.d, clients);
      break;

    case GatewayOpcode.CALL_ANSWER:
      await handleCallAnswer(ws, message.d, clients);
      break;

    case GatewayOpcode.CALL_ICE_CANDIDATE:
      await handleCallIceCandidate(ws, message.d, clients);
      break;

    default:
      // Unknown opcode - ignore silently
  }
};

const handlePresenceUpdate = async (
  ws: AuthenticatedWebSocket,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  if (!ws.userId) return;

  const { status } = data;

  // Update user status in database
  await query("UPDATE users SET status = $1 WHERE id = $2", [
    status,
    ws.userId,
  ]);

  // Broadcast to friends
  const friendsResult = await query(
    `SELECT user_id, friend_id FROM friends 
     WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
    [ws.userId]
  );

  friendsResult.rows.forEach((row: any) => {
    const friendId = row.user_id === ws.userId ? row.friend_id : row.user_id;
    const friendClient = clients.get(friendId);
    if (friendClient && friendClient.readyState === WebSocket.OPEN) {
      friendClient.send(
        JSON.stringify({
          op: 0, // DISPATCH
          t: "PRESENCE_UPDATE",
          d: {
            userId: ws.userId,
            status: status,
          },
        })
      );
    }
  });
};

const handleVoiceStateUpdate = async (
  ws: AuthenticatedWebSocket,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  if (!ws.userId) return;

  const { channelId, serverId, selfMute, selfDeaf } = data;

  // Broadcast voice state update to server members
  if (serverId) {
    const membersResult = await query(
      "SELECT user_id FROM members WHERE server_id = $1",
      [serverId]
    );

    membersResult.rows.forEach((member: any) => {
      const client = clients.get(member.user_id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            op: GatewayOpcode.DISPATCH,
            t: "VOICE_STATE_UPDATE",
            d: {
              user_id: ws.userId,
              channel_id: channelId,
              self_mute: selfMute,
              self_deaf: selfDeaf,
            },
          })
        );
      }
    });
  }
};

const handleCallStart = async (
  ws: AuthenticatedWebSocket,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  if (!ws.userId) return;

  const { userId, channelId, type, callId } = data; // type: 'voice' | 'video'

  console.log("[DEBUG] CALL_START received:", { from: ws.userId, to: userId, callId, type });

  // Send call notification to target user
  const targetClient = clients.get(userId);
  if (targetClient && targetClient.readyState === WebSocket.OPEN) {
    console.log("[DEBUG] Sending CALL_START to target user:", userId);
    const message = JSON.stringify({
      op: GatewayOpcode.DISPATCH,
      t: "CALL_START",
      d: {
        from: ws.userId,
        channelId,
        type,
        callId,
      },
    });
    console.log("[DEBUG] CALL_START message:", message);
    targetClient.send(message);
    console.log("[DEBUG] CALL_START sent successfully to:", userId);
  } else {
    console.log("[DEBUG] Target client not found or not open:", { 
      userId, 
      found: !!targetClient, 
      readyState: targetClient?.readyState,
      allClients: Array.from(clients.keys())
    });
  }
};

const handleCallEnd = async (
  ws: AuthenticatedWebSocket,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  if (!ws.userId) return;

  const { userId, callId } = data;

  // Notify target user that call ended
  const targetClient = clients.get(userId);
  if (targetClient && targetClient.readyState === WebSocket.OPEN) {
    targetClient.send(
      JSON.stringify({
        op: GatewayOpcode.DISPATCH,
        t: "CALL_END",
        d: {
          userId: ws.userId,
          callId,
        },
      })
    );
  }
};

const handleCallOffer = async (
  ws: AuthenticatedWebSocket,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  if (!ws.userId) return;

  const { userId, offer, callId } = data;

  console.log("[DEBUG] CALL_OFFER received:", { from: ws.userId, to: userId, callId });

  // Forward WebRTC offer to target user
  const targetClient = clients.get(userId);
  if (targetClient && targetClient.readyState === WebSocket.OPEN) {
    console.log("[DEBUG] Forwarding CALL_OFFER to:", userId);
    targetClient.send(
      JSON.stringify({
        op: GatewayOpcode.DISPATCH,
        t: "CALL_OFFER",
        d: {
          userId: ws.userId,
          offer,
          callId,
        },
      })
    );
  } else {
    console.log("[DEBUG] Target client not found for CALL_OFFER:", { userId, found: !!targetClient });
  }
};

const handleCallAnswer = async (
  ws: AuthenticatedWebSocket,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  if (!ws.userId) return;

  const { userId, answer, callId } = data;

  // Forward WebRTC answer to target user
  const targetClient = clients.get(userId);
  if (targetClient && targetClient.readyState === WebSocket.OPEN) {
    targetClient.send(
      JSON.stringify({
        op: GatewayOpcode.DISPATCH,
        t: "CALL_ANSWER",
        d: {
          userId: ws.userId,
          answer,
          callId,
        },
      })
    );
  }
};

const handleCallIceCandidate = async (
  ws: AuthenticatedWebSocket,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  if (!ws.userId) return;

  const { userId, candidate, callId } = data;

  // Forward ICE candidate to target user
  const targetClient = clients.get(userId);
  if (targetClient && targetClient.readyState === WebSocket.OPEN) {
    targetClient.send(
      JSON.stringify({
        op: GatewayOpcode.DISPATCH,
        t: "CALL_ICE_CANDIDATE",
        d: {
          userId: ws.userId,
          candidate,
          callId,
        },
      })
    );
  }
};

// Helper function to broadcast message to channel
export const broadcastToChannel = async (
  channelId: string,
  event: string,
  data: any,
  clients: Map<string, AuthenticatedWebSocket>
) => {
  // Get channel info
  const channelResult = await query("SELECT * FROM channels WHERE id = $1", [
    channelId,
  ]);

  if (channelResult.rows.length === 0) return;

  const channel = channelResult.rows[0];

  let userIds: string[] = [];

  if (channel.server_id) {
    // Get all members of the server
    const membersResult = await query(
      "SELECT user_id FROM members WHERE server_id = $1",
      [channel.server_id]
    );
    userIds = membersResult.rows.map((m: any) => m.user_id);
  } else if (channel.type === "DM" || channel.type === "GROUP_DM") {
    // Get DM participants
    const participantsResult = await query(
      "SELECT user_id FROM dm_participants WHERE channel_id = $1",
      [channelId]
    );
    userIds = participantsResult.rows.map((p: any) => p.user_id);
  }

  // Broadcast to all relevant clients
  userIds.forEach((userId) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          op: GatewayOpcode.DISPATCH,
          t: event,
          d: data,
        })
      );
    }
  });
};

