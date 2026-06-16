import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { config } from "../lib/config";

const ROOMS = ["general", "vip", "highrollers", "offtopic", "sports"] as const;
type Room = (typeof ROOMS)[number];

const MAX_MESSAGES_PER_ROOM = 200;
const HISTORY_LIMIT = 50;
const MAX_MSG_LENGTH = 300;
const RATE_LIMIT_COUNT = 2;
const RATE_LIMIT_WINDOW_MS = 3000;

interface ChatMessage {
  username: string;
  rank: string;
  message: string;
  timestamp: number;
  room: Room;
}

interface RateEntry {
  count: number;
  windowStart: number;
}

interface AuthedSocket extends Socket {
  data: { userId?: string; username?: string; rank?: string };
}

export class ChatEngine {
  private io: Server;
  private messages: Map<Room, ChatMessage[]> = new Map();
  private rateLimits: Map<string, RateEntry> = new Map();

  constructor(io: Server) {
    this.io = io;
    for (const room of ROOMS) {
      this.messages.set(room, []);
    }
    this.attach();
  }

  private attach() {
    const namespace = this.io.of("/chat");

    namespace.use(async (socket: AuthedSocket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        try {
          const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, username: true, rank: true },
          });
          if (user) {
            socket.data.userId = user.id;
            socket.data.username = user.username;
            socket.data.rank = user.rank ?? "bronze";
          }
        } catch {
          // Will reject on chat:send if not authed
        }
      }
      next();
    });

    namespace.on("connection", (socket: AuthedSocket) => {
      socket.on("chat:join", (payload: unknown) => {
        const body = payload as { room?: unknown };
        const room = String(body?.room ?? "general") as Room;
        if (!ROOMS.includes(room)) return;

        // Leave previous rooms
        for (const r of ROOMS) {
          socket.leave(r);
        }
        socket.join(room);

        const history = (this.messages.get(room) ?? []).slice(-HISTORY_LIMIT);
        socket.emit("chat:history", { room, messages: history });
      });

      socket.on("chat:send", (payload: unknown) => {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit("chat:error", { error: "Authentication required" });
          return;
        }

        const body = payload as { message?: unknown; room?: unknown };
        const message = String(body?.message ?? "").trim();
        const room = String(body?.room ?? "general") as Room;

        if (!ROOMS.includes(room)) {
          socket.emit("chat:error", { error: "Invalid room" });
          return;
        }
        if (!message || message.length === 0) {
          socket.emit("chat:error", { error: "Message cannot be empty" });
          return;
        }
        if (message.length > MAX_MSG_LENGTH) {
          socket.emit("chat:error", { error: `Message too long (max ${MAX_MSG_LENGTH} chars)` });
          return;
        }
        if (/https?:\/\//i.test(message)) {
          socket.emit("chat:error", { error: "URLs are not allowed in chat" });
          return;
        }

        // Strip HTML tags
        const sanitized = message.replace(/<[^>]*>/g, "").trim();
        if (!sanitized) {
          socket.emit("chat:error", { error: "Message cannot be empty after sanitization" });
          return;
        }

        // Rate limit
        const now = Date.now();
        const rateKey = userId;
        const entry = this.rateLimits.get(rateKey);
        if (entry && now - entry.windowStart < RATE_LIMIT_WINDOW_MS) {
          if (entry.count >= RATE_LIMIT_COUNT) {
            socket.emit("chat:error", { error: "Slow down — max 2 messages per 3 seconds" });
            return;
          }
          entry.count++;
        } else {
          this.rateLimits.set(rateKey, { count: 1, windowStart: now });
        }

        const chatMsg: ChatMessage = {
          username: socket.data.username ?? "player",
          rank: socket.data.rank ?? "bronze",
          message: sanitized,
          timestamp: now,
          room,
        };

        const roomMessages = this.messages.get(room) ?? [];
        roomMessages.push(chatMsg);
        // Circular buffer: trim to MAX_MESSAGES_PER_ROOM
        if (roomMessages.length > MAX_MESSAGES_PER_ROOM) {
          roomMessages.splice(0, roomMessages.length - MAX_MESSAGES_PER_ROOM);
        }
        this.messages.set(room, roomMessages);

        namespace.to(room).emit("chat:message", chatMsg);
      });
    });
  }
}
