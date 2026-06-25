import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { signToken, requireAuth, AuthedRequest } from "../middleware/auth";
import { createSeedPair } from "../lib/provablyFair";
import { config } from "../lib/config";
import { sendVerificationCode } from "../lib/mailer";
import { isOwner } from "../lib/owner";
import { getSiteConfig } from "../lib/siteConfig";

export const authRouter = Router();

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

const credentialsSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20).regex(/^[a-zA-Z0-9_]+$/, "Username: letters, numbers, underscore only"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  patreonUsername: z.string().min(1).max(50).optional().nullable(),
});

authRouter.post("/register", async (req, res) => {
  const registrationEnabled = ((await getSiteConfig("registrationEnabled")) ?? "true") !== "false";
  if (!registrationEnabled) return res.status(503).json({ error: "New registrations are temporarily closed." });

  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { username, password, patreonUsername } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: { equals: username, mode: "insensitive" } }, { email }] },
    });
    if (existing) return res.status(409).json({ error: "Username or email already taken" });

    const passwordHash = await bcrypt.hash(password, 10);
    const seedPair = createSeedPair();
    const emailToken = generateCode();
    const emailCodeExpiryMinutes = Number((await getSiteConfig("emailCodeExpiryMinutes")) ?? 15);
    const emailTokenExpiry = new Date(Date.now() + emailCodeExpiryMinutes * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        balance: config.startingBalance,
        serverSeed: seedPair.serverSeed,
        serverSeedHash: seedPair.serverSeedHash,
        clientSeed: seedPair.clientSeed,
        emailVerified: false,
        emailToken,
        emailTokenExpiry,
        patreonUsername: patreonUsername ?? null,
        isApproved: false,
      },
    });

    const emailed = await sendVerificationCode(email, username, emailToken).catch(() => false);

    res.status(201).json({
      token: signToken(user.id),
      user: publicUser(user),
      message: emailed
        ? "Account created! Check your email for a 6-digit verification code."
        : "Account created! Email isn't configured yet, so here's your code directly.",
      ...(emailed ? {} : { devCode: emailToken }),
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const field = err?.meta?.target?.includes("email") ? "email" : "username";
      return res.status(409).json({ error: `That ${field} is already taken` });
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed — please try again" });
  }
});

// ---------------------------------------------------------------------------
// Verify email via a 6-digit code entered in the app
// ---------------------------------------------------------------------------
authRouter.post("/verify-email-code", requireAuth, async (req: AuthedRequest, res) => {
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ error: "Code required" });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.json({ user: publicUser(user) });

    if (
      !user.emailToken ||
      user.emailToken !== code.trim() ||
      !user.emailTokenExpiry ||
      user.emailTokenExpiry < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailToken: null, emailTokenExpiry: null },
    });

    res.json({ user: publicUser(updated) });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ error: "Verification failed — please try again" });
  }
});

// ---------------------------------------------------------------------------
// Resend the verification code
// ---------------------------------------------------------------------------
authRouter.post("/resend-verification", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.json({ message: "Email already verified." });

    const emailToken = generateCode();
    const emailCodeExpiryMinutes = Number((await getSiteConfig("emailCodeExpiryMinutes")) ?? 15);
    const emailTokenExpiry = new Date(Date.now() + emailCodeExpiryMinutes * 60 * 1000);

    await prisma.user.update({ where: { id: user.id }, data: { emailToken, emailTokenExpiry } });
    const emailed = await sendVerificationCode(user.email, user.username, emailToken).catch(() => false);

    res.json({
      message: emailed
        ? "A new code has been sent to your email."
        : "Email isn't configured yet, so here's your code directly.",
      ...(emailed ? {} : { devCode: emailToken }),
    });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ error: "Failed to resend — please try again" });
  }
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Username/email and password are required" });

  const { identifier, password } = parsed.data;
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    if (user.isBanned) return res.status(403).json({ error: "Account banned. Contact support." });

    const token = signToken(user.id);
    const pub = publicUser(user);

    if (!user.emailVerified) {
      // Issue a fresh code on login too — the original one may be long expired
      // by the time the user comes back to verify.
      const emailToken = generateCode();
      const emailCodeExpiryMinutes = Number((await getSiteConfig("emailCodeExpiryMinutes")) ?? 15);
      const emailTokenExpiry = new Date(Date.now() + emailCodeExpiryMinutes * 60 * 1000);
      await prisma.user.update({ where: { id: user.id }, data: { emailToken, emailTokenExpiry } });
      const emailed = await sendVerificationCode(user.email, user.username, emailToken).catch(() => false);
      return res.json({
        token,
        user: pub,
        needsEmailVerification: true,
        ...(emailed ? {} : { devCode: emailToken }),
      });
    }

    // Owner is always approved regardless of DB value
    const ownerUser = isOwner(user.username);

    // Check subscription expiry (skip for owner/admin)
    if (!ownerUser && !user.isAdmin && user.isApproved && user.approvedUntil && user.approvedUntil < new Date()) {
      await prisma.user.update({ where: { id: user.id }, data: { isApproved: false } });
      return res.json({ token, user: { ...pub, isApproved: false }, pendingApproval: true });
    }

    // If account is pending approval, return token but flag it (skip for owner/admin)
    if (!ownerUser && !user.isAdmin && !user.isApproved) {
      return res.json({ token, user: pub, pendingApproval: true });
    }

    res.json({ token, user: pub });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed — please try again" });
  }
});

// ---------------------------------------------------------------------------
// Google Sign-In — verifies a Google ID token, then logs in or registers
// ---------------------------------------------------------------------------
async function usernameFromEmail(email: string): Promise<string> {
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "player";
  let candidate = base;
  let suffix = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 20);
  }
  return candidate;
}

authRouter.post("/google", async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) return res.status(400).json({ error: "Missing Google ID token" });

  try {
    const googleClientId = (await getSiteConfig("google_client_id")) ?? process.env.GOOGLE_CLIENT_ID ?? null;
    if (!googleClientId) return res.status(503).json({ error: "Google Sign-In is not configured" });

    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(401).json({ error: "Invalid Google account" });
    }

    const email = payload.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const registrationEnabled = ((await getSiteConfig("registrationEnabled")) ?? "true") !== "false";
      if (!registrationEnabled) return res.status(503).json({ error: "New registrations are temporarily closed." });

      const username = await usernameFromEmail(email);
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
      const seedPair = createSeedPair();
      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          balance: config.startingBalance,
          serverSeed: seedPair.serverSeed,
          serverSeedHash: seedPair.serverSeedHash,
          clientSeed: seedPair.clientSeed,
          emailVerified: true,
          isApproved: false,
        },
      });
    }

    if (user.isBanned) return res.status(403).json({ error: "Account banned. Contact support." });

    const token = signToken(user.id);
    const pub = publicUser(user);
    const ownerUser = isOwner(user.username);

    if (!ownerUser && !user.isAdmin && user.isApproved && user.approvedUntil && user.approvedUntil < new Date()) {
      await prisma.user.update({ where: { id: user.id }, data: { isApproved: false } });
      return res.json({ token, user: { ...pub, isApproved: false }, pendingApproval: true });
    }

    if (!ownerUser && !user.isAdmin && !user.isApproved) {
      return res.json({ token, user: pub, pendingApproval: true });
    }

    res.json({ token, user: pub });
  } catch (err) {
    console.error("Google sign-in error:", err);
    res.status(401).json({ error: "Google sign-in failed" });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    // Auto-revoke expired subscriptions. Netherite (admin tier) also loses
    // admin powers when its subscription lapses.
    if (user.isApproved && user.approvedUntil && user.approvedUntil < new Date()) {
      const stripAdmin = user.patreonTier === "netherite_patron";
      await prisma.user.update({ where: { id: user.id }, data: { isApproved: false, ...(stripAdmin ? { isAdmin: false } : {}) } });
      user.isApproved = false;
      if (stripAdmin) user.isAdmin = false;
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Failed to load account" });
  }
});

export function publicUser(user: {
  id: string;
  username: string;
  nickname: string | null;
  rank: string;
  email: string;
  balance: number;
  bank: number;
  level: number;
  xp: number;
  createdAt: Date;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  emailVerified: boolean;
  isAdmin?: boolean;
  isApproved?: boolean;
  approvedUntil?: Date | null;
  patreonUsername?: string | null;
  patreonTier?: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    rank: isOwner(user.username) ? "owner" : user.rank,
    email: user.email,
    balance: user.balance,
    bank: user.bank,
    level: user.level,
    xp: user.xp,
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
    isAdmin: (user.isAdmin ?? false) || isOwner(user.username),
    isApproved: isOwner(user.username) ? true : (user.isApproved ?? true),
    approvedUntil: user.approvedUntil ?? null,
    patreonUsername: user.patreonUsername ?? null,
    patreonTier: user.patreonTier ?? null,
    fairness: {
      activeServerSeedHash: user.serverSeedHash,
      clientSeed: user.clientSeed,
      nonce: user.nonce,
    },
  };
}
