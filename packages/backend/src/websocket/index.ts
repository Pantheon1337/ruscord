import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { GatewayOpcode } from "@ruscord/shared";
import { handleWebSocketMessage } from "./handlers";
import { query } from "../database";

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

let clientsMap: Map<string, AuthenticatedWebSocket> | null = null;

export const getClients = () => clientsMap;

export const setupWebSocket = (wss: WebSocketServer) => {
  const clients = new Map<string, AuthenticatedWebSocket>();
  clientsMap = clients;

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle identify
        if (message.op === GatewayOpcode.IDENTIFY) {
          const token = message.d?.token;

          if (!token) {
            ws.send(
              JSON.stringify({
                op: GatewayOpcode.INVALID_SESSION,
                d: false,
              })
            );
            return ws.close();
          }

          try {
            const decoded = jwt.verify(
              token,
              process.env.JWT_SECRET || "secret"
            ) as { userId: string };

            ws.userId = decoded.userId;
            clients.set(decoded.userId, ws);

            // Update user status to online when connecting
            await query("UPDATE users SET status = $1 WHERE id = $2", [
              "online",
              decoded.userId,
            ]);

            // Broadcast online status to friends
            const friendsResult = await query(
              `SELECT user_id, friend_id FROM friends 
               WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
              [decoded.userId]
            );

            friendsResult.rows.forEach((row: any) => {
              const friendId = row.user_id === decoded.userId ? row.friend_id : row.user_id;
              const friendClient = clients.get(friendId);
              if (friendClient && friendClient.readyState === WebSocket.OPEN) {
                friendClient.send(
                  JSON.stringify({
                    op: GatewayOpcode.DISPATCH,
                    t: "PRESENCE_UPDATE",
                    d: {
                      userId: decoded.userId,
                      status: "online",
                    },
                  })
                );
              }
            });

            ws.send(
              JSON.stringify({
                op: GatewayOpcode.HELLO,
                d: {
                  heartbeat_interval: 30000,
                },
              })
            );

            // Start heartbeat
            const heartbeat = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    op: GatewayOpcode.HEARTBEAT,
                  })
                );
              } else {
                clearInterval(heartbeat);
              }
            }, 30000);
          } catch (error) {
            ws.send(
              JSON.stringify({
                op: GatewayOpcode.INVALID_SESSION,
                d: false,
              })
            );
            return ws.close();
          }
        }

        // Handle heartbeat
        if (message.op === GatewayOpcode.HEARTBEAT) {
          ws.send(
            JSON.stringify({
              op: GatewayOpcode.HEARTBEAT_ACK,
            })
          );
          return;
        }

        // Handle other messages only if user is authenticated
        if (ws.userId) {
          await handleWebSocketMessage(ws, message, clients);
        }
        // IDENTIFY and HEARTBEAT are already handled above, so we don't need to log them here
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", async () => {
      if (ws.userId) {
        // Update status to offline
        try {
          await query("UPDATE users SET status = $1 WHERE id = $2", [
            "offline",
            ws.userId,
          ]);
          
          // Broadcast offline status to friends only
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
                  op: GatewayOpcode.DISPATCH,
                  t: "PRESENCE_UPDATE",
                  d: {
                    userId: ws.userId,
                    status: "offline",
                  },
                })
              );
            }
          });
        } catch (error) {
          // Silent error handling
        }
        
        clients.delete(ws.userId);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });
};

