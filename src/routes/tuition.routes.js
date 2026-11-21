import { Router } from "express";
import { getDb } from "../config/db.js";

const router = Router();

router.get("/featured", async (req, res) => {
  const db = await getDb();
  const data = await db.collection("tuitions")
    .find({ approvalStatus: "approved", isActive: true })
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();

  res.json({ success: true, data });
});

export default router;
