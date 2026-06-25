import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { getStripe } from "../lib/stripe";
import { publicUser } from "./auth";

export const payoutRouter = Router();
payoutRouter.use(requireAuth as any);

// ---------------------------------------------------------------------------
// Card payout method — collected via a Stripe-hosted Checkout session in
// "setup" mode, which tokenizes the card (we only ever store a Stripe
// payment-method id, never the raw card number) without charging anything.
// ---------------------------------------------------------------------------

payoutRouter.post("/card-session", async (req: AuthedRequest, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Card collection isn't configured. Add STRIPE_SECRET_KEY to environment variables." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.username });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: `${origin}/?payout_setup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payout_setup=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Payout card-session error:", err);
    res.status(500).json({ error: "Failed to start card setup — please try again" });
  }
});

payoutRouter.post("/card-confirm", async (req: AuthedRequest, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "Card collection isn't configured" });

    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: "Missing session id" });

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] });
    if (session.mode !== "setup" || session.status !== "complete") {
      return res.status(400).json({ error: "Card setup wasn't completed" });
    }

    const setupIntent = session.setup_intent as { payment_method?: string } | string | null;
    const paymentMethodId = typeof setupIntent === "object" && setupIntent ? setupIntent.payment_method : null;
    if (!paymentMethodId) return res.status(400).json({ error: "No card was saved" });

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    const updated = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        payoutMethod: "card",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
        stripePaymentMethodId: paymentMethodId,
        stripeCardBrand: paymentMethod.card?.brand ?? null,
        stripeCardLast4: paymentMethod.card?.last4 ?? null,
      },
    });

    res.json({ user: publicUser(updated) });
  } catch (err) {
    console.error("Payout card-confirm error:", err);
    res.status(500).json({ error: "Failed to save card — please try again" });
  }
});
