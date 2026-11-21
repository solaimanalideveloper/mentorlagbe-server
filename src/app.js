import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { getAuth } from "./config/auth.js";
import tokenRoutes from "./routes/token.routes.js";
import tuitionRoutes from "./routes/tuition.routes.js";
import userRoutes from "./routes/user.routes.js";
import applicationRoutes from "./routes/application.routes.js";
import tutorRoutes from "./routes/tutor.routes.js";
import studentRoutes from "./routes/student.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import studentExtrasRoutes from "./routes/student-extras.routes.js";

const app = express();
const clientURL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(cors({
  origin: [clientURL, "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    const auth = await getAuth();
    return toNodeHandler(auth)(req, res);
  } catch (error) {
    return next(error);
  }
});

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", name: "MentorLagbe API" });
});

app.use("/api/token", tokenRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tuitions", tuitionRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/tutor", tutorRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api", studentExtrasRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

export default app;
