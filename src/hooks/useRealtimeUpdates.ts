/**
 * React hook for real-time updates via WebSocket
 */

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { WebSocketEvents } from "@/server/websocket";

interface UseRealtimeUpdatesOptions {
  circleId?: string;
  userId?: string;
  onContributionConfirmed?: (data: WebSocketEvents["contribution:confirmed"]) => void;
  onPayoutProcessed?: (data: WebSocketEvents["payout:processed"]) => void;
  onCircleCompleted?: (data: WebSocketEvents["circle:completed"]) => void;
  onCircleStarted?: (data: WebSocketEvents["circle:started"]) => void;
  onChatMessage?: (data: WebSocketEvents["chat:message"]) => void;
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions) {
  const {
    circleId,
    userId,
    onContributionConfirmed,
    onPayoutProcessed,
    onCircleCompleted,
    onCircleStarted,
    onChatMessage,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socket = io({
      path: "/api/socket",
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[realtime] Connected to WebSocket server");
      setIsConnected(true);
      setError(null);

      // Authenticate (in production, send actual JWT token)
      socket.emit("authenticate", "token");

      // Subscribe to circle updates
      if (circleId) {
        socket.emit("subscribe:circle", circleId);
      }

      // Subscribe to user updates
      if (userId) {
        socket.emit("subscribe:user", userId);
      }
    });

    socket.on("disconnect", () => {
      console.log("[realtime] Disconnected from WebSocket server");
      setIsConnected(false);
    });

    socket.on("error", (err: { message: string }) => {
      console.error("[realtime] WebSocket error:", err);
      setError(err.message);
    });

    // Set up event listeners
    if (onContributionConfirmed) {
      socket.on("contribution:confirmed", onContributionConfirmed);
    }

    if (onPayoutProcessed) {
      socket.on("payout:processed", onPayoutProcessed);
    }

    if (onCircleCompleted) {
      socket.on("circle:completed", onCircleCompleted);
    }

    if (onCircleStarted) {
      socket.on("circle:started", onCircleStarted);
    }

    if (onChatMessage) {
      socket.on("chat:message", onChatMessage);
    }

    // Cleanup on unmount
    return () => {
      if (circleId) {
        socket.emit("unsubscribe:circle", circleId);
      }
      socket.disconnect();
    };
  }, [
    circleId,
    userId,
    onContributionConfirmed,
    onPayoutProcessed,
    onCircleCompleted,
    onCircleStarted,
    onChatMessage,
  ]);

  return {
    isConnected,
    error,
    socket: socketRef.current,
  };
}
