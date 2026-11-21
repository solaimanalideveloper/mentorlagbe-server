import { Router } from "express";
import { getDb } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyTutor } from "../middlewares/verifyTutor.js";

const router = Router();

router.get("/tuitions", verifyToken, verifyTutor, async (req, res) => {
  const db = await getDb();
  const tuitions = await db.collection("tuitions")
    .find({ tutorEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(tuitions);
});

router.get("/applicants", verifyToken, verifyTutor, async (req, res) => {
  const db = await getDb();
  const applicants = await db.collection("applications")
    .find({ tutorEmail: req.user.email })
    .sort({ appliedAt: -1 })
    .toArray();
  res.json(applicants);
});

router.get("/stats", verifyToken, verifyTutor, async (req, res) => {
  const db = await getDb();
  const tuitions = db.collection("tuitions");
  const applications = db.collection("applications");
  const [totalTuitions, activeApproved, totalApplicants] = await Promise.all([
    tuitions.countDocuments({ tutorEmail: req.user.email }),
    tuitions.countDocuments({ tutorEmail: req.user.email, approvalStatus: "approved", isActive: true }),
    applications.countDocuments({ tutorEmail: req.user.email }),
  ]);
  res.json({ totalTuitions, activeApproved, totalApplicants, plan: req.user.plan });
});

export default router;
