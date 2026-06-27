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
  // userId -> set of live socket ids, so private messages can be delivered
  // to every device a user is connected on.
  private userSockets: Map<string, Set<string>> = new Map();

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
      // Track this socket against its user for private-message delivery.
      if (socket.data.userId) {
        let set = this.userSockets.get(socket.data.userId);
        if (!set) { set = new Set(); this.userSockets.set(socket.data.userId, set); }
        set.add(socket.id);
      }
      socket.on("disconnect", () => {
        if (!socket.data.userId) return;
        const set = this.userSockets.get(socket.data.userId);
        if (set) { set.delete(socket.id); if (set.size === 0) this.userSockets.delete(socket.data.userId); }
      });

      // ── Private messages (DMs) ────────────────────────────────────────────
      socket.on("dm:send", async (payload: unknown) => {
        const userId = socket.data.userId;
        if (!userId) return socket.emit("dm:error", { error: "Login required" });
        const body = payload as { toUsername?: unknown; message?: unknown };
        const toUsername = String(body?.toUsername ?? "").trim();
        const message = String(body?.message ?? "").trim().slice(0, MAX_MSG_LENGTH).replace(/<[^>]*>/g, "");
        if (!toUsername || !message) return socket.emit("dm:error", { error: "Recipient and message required" });
        if (toUsername.toLowerCase() === (socket.data.username ?? "").toLowerCase()) {
          return socket.emit("dm:error", { error: "You can't message yourself" });
        }
        // Rate limit reusing the chat limiter.
        const now = Date.now();
        const entry = this.rateLimits.get(userId);
        if (entry && now - entry.windowStart < RATE_LIMIT_WINDOW_MS && entry.count >= RATE_LIMIT_COUNT) {
          return socket.emit("dm:error", { error: "Slow down a moment." });
        }
        this.rateLimits.set(userId, entry && now - entry.windowStart < RATE_LIMIT_WINDOW_MS ? { count: entry.count + 1, windowStart: entry.windowStart } : { count: 1, windowStart: now });

        const recipient = await prisma.user.findFirst({ where: { username: { equals: toUsername, mode: "insensitive" } }, select: { id: true, username: true } });
        if (!recipient) return socket.emit("dm:error", { error: "No player with that username" });

        const dm = await prisma.directMessage.create({
          data: { fromId: userId, fromName: socket.data.username ?? "player", toId: recipient.id, toName: recipient.username, message },
        });
        const out = { id: dm.id, fromName: dm.fromName, toName: dm.toName, message: dm.message, createdAt: dm.createdAt };
        // Deliver to recipient's and sender's live sockets.
        for (const sid of [...(this.userSockets.get(recipient.id) ?? []), ...(this.userSockets.get(userId) ?? [])]) {
          namespace.to(sid).emit("dm:message", out);
        }
      });

      socket.on("dm:history", async (payload: unknown) => {
        const userId = socket.data.userId;
        if (!userId) return socket.emit("dm:error", { error: "Login required" });
        const withUsername = String((payload as { withUsername?: unknown })?.withUsername ?? "").trim();
        const other = await prisma.user.findFirst({ where: { username: { equals: withUsername, mode: "insensitive" } }, select: { id: true, username: true } });
        if (!other) return socket.emit("dm:history", { withUsername, messages: [] });
        const all = await prisma.directMessage.findMany({
          where: { OR: [{ fromId: userId, toId: other.id }, { fromId: other.id, toId: userId }] },
          orderBy: { createdAt: "asc" },
        });
        socket.emit("dm:history", {
          withUsername: other.username,
          messages: all.slice(-HISTORY_LIMIT).map((m: { id: string; fromName: string; toName: string; message: string; createdAt: Date }) => ({ id: m.id, fromName: m.fromName, toName: m.toName, message: m.message, createdAt: m.createdAt })),
        });
      });

      socket.on("dm:threads", async () => {
        const userId = socket.data.userId;
        if (!userId) return socket.emit("dm:threads", { threads: [] });
        const mine = await prisma.directMessage.findMany({
          where: { OR: [{ fromId: userId }, { toId: userId }] },
          orderBy: { createdAt: "desc" },
        });
        const seen = new Map<string, { name: string; last: string; at: Date }>();
        for (const m of mine as { fromId: string; fromName: string; toName: string; message: string; createdAt: Date }[]) {
          const partner = m.fromId === userId ? m.toName : m.fromName;
          if (!seen.has(partner.toLowerCase())) seen.set(partner.toLowerCase(), { name: partner, last: m.message, at: m.createdAt });
        }
        socket.emit("dm:threads", { threads: [...seen.values()] });
      });

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
