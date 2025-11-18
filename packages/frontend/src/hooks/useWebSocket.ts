import { useEffect, useRef } from "react";
import { wsManager } from "../services/websocket";

interface WebSocketMessage {
  op: number;
  t?: string;
  d?: any;
}

export function useWebSocket(onMessage?: (message: WebSocketMessage) => void) {
  const onMessageRef = useRef(onMessage);

  // Keep onMessage ref up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!onMessageRef.current) return;

    const unsubscribe = wsManager.subscribe((message) => {
      if (onMessageRef.current) {
        onMessageRef.current(message);
      }
    });

    return unsubscribe;
  }, []);

  // Return a ref-like object for backward compatibility
  return {
    current: {
      send: (message: any) => wsManager.send(message),
      readyState: wsManager.getReadyState(),
    },
  };
}

