import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyAdmin } from "../middlewares/verifyAdmin.js";

const router = Router();

router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  const db = await getDb();
  const [totalUsers, totalTutors, totalStudents, pendingTuitions, approvedTuitions, payments] =
    await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("users").countDocuments({ role: "tutor" }),
      db.collection("users").countDocuments({ role: "student" }),
      db.collection("tuitions").countDocuments({ approvalStatus: "pending" }),
      db.collection("tuitions").countDocuments({ approvalStatus: "approved" }),
      db.collection("payments").find({ paymentStatus: "paid" }).toArray(),
    ]);
  const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  res.json({ totalUsers, totalTutors, totalStudents, pendingTuitions, approvedTuitions, totalRevenue });
});

router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  const db = await getDb();
  const users = await db.collection("users").find({}, {
    projection: { name: 1, email: 1, image: 1, role: 1, plan: 1, phone: 1, bio: 1, createdAt: 1 },
  }).sort({ createdAt: -1 }).toArray();
  res.json(users);
});

router.patch("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid user id." });
  if (!["student", "tutor", "admin"].includes(req.body.role)) {
    return res.status(400).json({ message: "Role must be student, tutor, or admin." });
  }

  const db = await getDb();
  const users = db.collection("users");
  const user = await users.findOne({ _id: new ObjectId(req.params.id) });
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user.email === req.user.email) return res.status(403).json({ message: "Admin cannot change their own role." });
  await users.updateOne({ _id: user._id }, { $set: { role: req.body.role } });
  res.json({ ...user, role: req.body.role });
});

router.get("/tuitions", verifyToken, verifyAdmin, async (req, res) => {
  const db = await getDb();
  const filter = {};
  if (req.query.approvalStatus) filter.approvalStatus = req.query.approvalStatus;
  const tuitions = await db.collection("tuitions").find(filter).sort({ createdAt: -1 }).toArray();
  res.json(tuitions);
});

router.patch("/tuitions/:id/approval", verifyToken, verifyAdmin, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid tuition id." });
  if (!["approved", "rejected"].includes(req.body.approvalStatus)) {
    return res.status(400).json({ message: "Approval status must be approved or rejected." });
  }
  const db = await getDb();
  const tuitions = db.collection("tuitions");
  const tuition = await tuitions.findOne({ _id: new ObjectId(req.params.id) });
  if (!tuition) return res.status(404).json({ message: "Tuition not found." });
  await tuitions.updateOne({ _id: tuition._id }, { $set: { approvalStatus: req.body.approvalStatus } });
  res.json({ ...tuition, approvalStatus: req.body.approvalStatus });
});

router.get("/transactions", verifyToken, verifyAdmin, async (req, res) => {
  const db = await getDb();
  const payments = await db.collection("payments").find({}).sort({ paidAt: -1 }).toArray();
  res.json(payments);
});

export default router;
