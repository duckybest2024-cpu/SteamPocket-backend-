import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

/** Player-submitted reports — anyone can report another player. */
export const reportRouter = Router();
reportRouter.use(requireAuth);

const schema = z.object({
  reportedName: z.string().min(1, "Who are you reporting?").max(40),
  reason: z.string().min(1, "Add a reason").max(500),
  context: z.string().max(500).optional().nullable(),
});

reportRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!me) return res.status(404).json({ error: "User not found" });
  if (parsed.data.reportedName.toLowerCase() === me.username.toLowerCase()) {
    return res.status(400).json({ error: "You can't report yourself" });
  }

  await prisma.report.create({
    data: {
      reporterId: me.id,
      reporterName: me.username,
      reportedName: parsed.data.reportedName.trim(),
      reason: parsed.data.reason.trim(),
      context: parsed.data.context ? parsed.data.context.slice(0, 500) : null,
    },
  });
  res.json({ ok: true });
});
