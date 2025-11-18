import { useAuthStore } from "../store/authStore";

interface WebSocketMessage {
  op: number;
  t?: string;
  d?: any;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private shouldReconnect = true;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.hostname}:3001`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        ws.send(
          JSON.stringify({
            op: 2, // IDENTIFY
            d: { token },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle HELLO message and start heartbeat
          if (message.op === 10) { // HELLO
            const heartbeatInterval = message.d?.heartbeat_interval || 30000;
            this.startHeartbeat(heartbeatInterval);
            
            // Send initial presence update
            this.send({
              op: 3, // PRESENCE_UPDATE
              d: {
                status: "online",
              },
            });
          }
          
          // Handle HEARTBEAT_ACK
          if (message.op === 11) { // HEARTBEAT_ACK
            // Heartbeat acknowledged, do nothing
            return;
          }
          
          // Dispatch to all handlers
          this.handlers.forEach((handler) => {
            try {
              handler(message);
            } catch (error) {
              console.error("Error in WebSocket message handler:", error);
            }
          });
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      };

      ws.onerror = (error) => {
        this.isConnecting = false;
        if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
          console.error("WebSocket error:", error);
        }
      };

      ws.onclose = (event) => {
        this.isConnecting = false;
        this.ws = null;
        this.stopHeartbeat();

        if (!this.shouldReconnect) {
          return;
        }

        // Don't reconnect if it was a normal closure (code 1000)
        if (event.code === 1000) {
          return;
        }

        // Attempt to reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

          this.reconnectTimeout = setTimeout(() => {
            if (this.shouldReconnect && useAuthStore.getState().token) {
              this.connect();
            }
          }, delay);
        }
      };
    } catch (error) {
      this.isConnecting = false;
      console.error("Failed to create WebSocket:", error);
    }
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            op: 1, // HEARTBEAT
          })
        );
      } else {
        this.stopHeartbeat();
      }
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000); // Normal closure
      this.ws = null;
    }
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    
    // Connect if not already connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    return () => {
      this.handlers.delete(handler);
    };
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  getReadyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

export const wsManager = new WebSocketManager();

