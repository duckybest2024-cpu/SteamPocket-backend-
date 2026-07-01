import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { publicUser } from "./auth";

export const settingsRouter = Router();
settingsRouter.use(requireAuth as any);

const settingsSchema = z.object({
  nickname: z.string().min(1).max(30).nullable().optional(),
  newUsername: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "letters, numbers, underscore only").optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(72).optional(),
  payoutMethod: z.enum(["paypal", "note"]).optional(),
  payoutPaypalEmail: z.string().email("Invalid PayPal email").optional(),
  payoutNote: z.string().min(3, "Please describe how you'd like to be paid").max(300).optional(),
});

settingsRouter.patch("/", async (req: AuthedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { nickname, newUsername, currentPassword, newPassword, payoutMethod, payoutPaypalEmail, payoutNote } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updates: Record<string, any> = {};

    if (nickname !== undefined) {
      updates.nickname = nickname?.trim() || null;
    }

    if (payoutMethod === "paypal") {
      if (!payoutPaypalEmail) return res.status(400).json({ error: "PayPal email is required" });
      updates.payoutMethod = "paypal";
      updates.payoutPaypalEmail = payoutPaypalEmail.toLowerCase();
      updates.payoutNote = null;
    } else if (payoutMethod === "note") {
      if (!payoutNote?.trim()) return res.status(400).json({ error: "Please describe how you'd like to be paid" });
      updates.payoutMethod = "note";
      updates.payoutNote = payoutNote.trim();
      updates.payoutPaypalEmail = null;
    }

    if (newUsername && newUsername !== user.username) {
      const taken = await prisma.user.findUnique({ where: { username: newUsername } });
      if (taken) return res.status(409).json({ error: "That username is already taken" });
      updates.username = newUsername;
    }

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: "Current password is required to set a new password" });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No changes provided" });
    }

    const updated = await prisma.user.update({ where: { id: req.userId! }, data: updates });
    res.json({ user: publicUser(updated) });
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(409).json({ error: "That username is already taken" });
    console.error("PATCH /settings error:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});
