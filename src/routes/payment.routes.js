import { Router } from "express";
import Stripe from "stripe";
import { getDb } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

router.post("/create-checkout-session", verifyToken, async (req, res) => {
  if (!["student", "tutor"].includes(req.user.role)) {
    return res.status(403).json({ message: "Admin cannot purchase a Pro plan." });
  }
  if (req.user.plan === "pro") {
    return res.status(400).json({ message: "You already have a Pro plan." });
  }

  const roleName = req.user.role === "tutor" ? "Tutor" : "Student";
  const amount = req.user.role === "tutor"
    ? Number(process.env.PRO_TUTOR_PRICE_USD || 15)
    : Number(process.env.PRO_STUDENT_PRICE_USD || 10);
  const configuredClientURL = process.env.CLIENT_URL;
  if (!configuredClientURL && process.env.NODE_ENV === "production") {
    throw new Error("CLIENT_URL must be configured in production.");
  }
  const clientURL = (configuredClientURL || "http://localhost:3000").replace(/\/$/, "");

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: req.user.email,
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: Math.round(amount * 100),
        product_data: { name: `MentorLagbe Pro ${roleName} Plan` },
      },
      quantity: 1,
    }],
    metadata: { email: req.user.email, role: req.user.role, plan: "pro" },
    success_url: `${clientURL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientURL}/payment/cancel`,
  });
  res.json({ url: session.url });
});

router.get("/verify", verifyToken, async (req, res) => {
  if (!req.query.session_id) return res.status(400).json({ message: "session_id is required." });
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  if (session.payment_status !== "paid") return res.status(400).json({ message: "Payment has not been completed." });

  const sessionEmail = session.metadata?.email || session.customer_details?.email || session.customer_email;
  if (sessionEmail !== req.user.email) return res.status(403).json({ message: "Payment belongs to another account." });

  const db = await getDb();
  const payments = db.collection("payments");
  const paymentIntent = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  await payments.updateOne(
    { stripeSessionId: session.id },
    {
      $setOnInsert: {
        userEmail: req.user.email,
        userName: req.user.name,
        userRole: req.user.role,
        planName: "pro",
        amount: Number((session.amount_total || 0) / 100),
        currency: session.currency || "usd",
        transactionId: paymentIntent || session.id,
        stripeSessionId: session.id,
        paymentStatus: "paid",
        paidAt: new Date(),
      },
    },
    { upsert: true },
  );
  await db.collection("users").updateOne({ email: req.user.email }, { $set: { plan: "pro" } });
  res.json({ success: true, plan: "pro" });
});

export default router;
