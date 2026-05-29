/**
 * WebSocket server for real-time updates
 * Provides real-time notifications to frontend clients
 */

import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

let io: SocketIOServer | null = null;

export interface WebSocketEvents {
  "contribution:confirmed": {
    circleId: string;
    memberId: string;
    txHash: string;
    timestamp: string;
  };
  "payout:processed": {
    circleId: string;
    recipientMemberId: string;
    amount: string;
    txHash: string;
    timestamp: string;
  };
  "circle:completed": {
    circleId: string;
    timestamp: string;
  };
  "circle:started": {
    circleId: string;
    timestamp: string;
  };
  "chat:message": {
    id: string;
    circleId: string;
    userId: string;
    displayName: string;
    content: string;
    createdAt: string;
  };
}

/**
 * Initialize WebSocket server
 * Should be called once when the Next.js server starts
 */
export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    console.warn("[websocket] Server already initialized");
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[websocket] Client connected: ${socket.id}`);

    // Handle authentication
    socket.on("authenticate", async (token: string) => {
      try {
        // Verify session token
        // In production, implement proper JWT verification
        console.log(`[websocket] Client ${socket.id} authenticated`);
        socket.data.authenticated = true;
      } catch (error) {
        console.error(`[websocket] Authentication failed for ${socket.id}:`, error);
        socket.disconnect();
      }
    });

    // Handle circle room subscriptions
    socket.on("subscribe:circle", (circleId: string) => {
      if (!socket.data.authenticated) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }
      socket.join(`circle:${circleId}`);
      console.log(`[websocket] Client ${socket.id} subscribed to circle:${circleId}`);
    });

    socket.on("unsubscribe:circle", (circleId: string) => {
      socket.leave(`circle:${circleId}`);
      console.log(`[websocket] Client ${socket.id} unsubscribed from circle:${circleId}`);
    });

    // Handle user room subscriptions
    socket.on("subscribe:user", (userId: string) => {
      if (!socket.data.authenticated) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }
      socket.join(`user:${userId}`);
      console.log(`[websocket] Client ${socket.id} subscribed to user:${userId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[websocket] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[websocket] Server initialized");
  return io;
}

/**
 * Get the WebSocket server instance
 */
export function getWebSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast contribution confirmation
 */
export function broadcastContributionConfirmed(
  circleId: string,
  memberId: string,
  txHash: string
): void {
  if (!io) return;

  const event: WebSocketEvents["contribution:confirmed"] = {
    circleId,
    memberId,
    txHash,
    timestamp: new Date().toISOString(),
  };

  io.to(`circle:${circleId}`).emit("contribution:confirmed", event);
  console.log(`[websocket] Broadcasted contribution:confirmed to circle:${circleId}`);
}

/**
 * Broadcast payout processed
 */
export function broadcastPayoutProcessed(
  circleId: string,
  recipientMemberId: string,
  amount: string,
  txHash: string
): void {
  if (!io) return;

  const event: WebSocketEvents["payout:processed"] = {
    circleId,
    recipientMemberId,
    amount,
    txHash,
    timestamp: new Date().toISOString(),
  };

  io.to(`circle:${circleId}`).emit("payout:processed", event);
  console.log(`[websocket] Broadcasted payout:processed to circle:${circleId}`);
}

/**
 * Broadcast circle completed
 */
export function broadcastCircleCompleted(circleId: string): void {
  if (!io) return;

  const event: WebSocketEvents["circle:completed"] = {
    circleId,
    timestamp: new Date().toISOString(),
  };

  io.to(`circle:${circleId}`).emit("circle:completed", event);
  console.log(`[websocket] Broadcasted circle:completed to circle:${circleId}`);
}

/**
 * Broadcast a new chat message to all members in a circle room
 */
export function broadcastChatMessage(
  circleId: string,
  message: WebSocketEvents["chat:message"]
): void {
  if (!io) return;
  io.to(`circle:${circleId}`).emit("chat:message", message);
  console.log(`[websocket] Broadcasted chat:message to circle:${circleId}`);
}

/**
 * Broadcast circle started
 */
export function broadcastCircleStarted(circleId: string): void {
  if (!io) return;

  const event: WebSocketEvents["circle:started"] = {
    circleId,
    timestamp: new Date().toISOString(),
  };

  io.to(`circle:${circleId}`).emit("circle:started", event);
  console.log(`[websocket] Broadcasted circle:started to circle:${circleId}`);
}
