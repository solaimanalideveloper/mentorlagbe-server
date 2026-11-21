import { Router } from "express";
import { getDb } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyStudent } from "../middlewares/verifyStudent.js";

const router = Router();

router.get("/stats", verifyToken, verifyStudent, async (req, res) => {
  const db = await getDb();
  const applications = db.collection("applications");
  const [total, accepted, pending] = await Promise.all([
    applications.countDocuments({ studentEmail: req.user.email }),
    applications.countDocuments({ studentEmail: req.user.email, status: "accepted" }),
    applications.countDocuments({ studentEmail: req.user.email, status: "pending" }),
  ]);
  res.json({ total, accepted, pending, plan: req.user.plan });
});

export default router;
