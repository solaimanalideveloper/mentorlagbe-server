import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyStudent } from "../middlewares/verifyStudent.js";

const router = Router();

router.post("/bookmarks/:tuitionId", verifyToken, verifyStudent, async (req, res) => {
  if (!ObjectId.isValid(req.params.tuitionId)) return res.status(400).json({ message: "Invalid tuition id." });
  const db = await getDb();
  const tuitionId = new ObjectId(req.params.tuitionId);
  if (!await db.collection("tuitions").findOne({ _id: tuitionId })) {
    return res.status(404).json({ message: "Tuition not found." });
  }
  const user = await db.collection("users").findOne({ email: req.user.email });
  const saved = Array.isArray(user?.savedTuitions) ? user.savedTuitions : [];
  const alreadySaved = saved.some((id) => id.toString() === tuitionId.toString());
  await db.collection("users").updateOne(
    { email: req.user.email },
    alreadySaved
      ? { $pull: { savedTuitions: tuitionId } }
      : { $addToSet: { savedTuitions: tuitionId } },
  );
  res.json({ saved: !alreadySaved });
});

router.get("/bookmarks", verifyToken, verifyStudent, async (req, res) => {
  const db = await getDb();
  const user = await db.collection("users").findOne({ email: req.user.email });
  const ids = Array.isArray(user?.savedTuitions) ? user.savedTuitions : [];
  const tuitions = await db.collection("tuitions").find({ _id: { $in: ids } }).toArray();
  res.json(tuitions);
});

router.post("/reviews/:tuitionId", verifyToken, verifyStudent, async (req, res) => {
  if (!ObjectId.isValid(req.params.tuitionId)) return res.status(400).json({ message: "Invalid tuition id." });
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5." });
  }
  const db = await getDb();
  const tuitionId = req.params.tuitionId;
  const accepted = await db.collection("applications").findOne({
    tuitionId,
    studentEmail: req.user.email,
    status: "accepted",
  });
  if (!accepted) return res.status(403).json({ message: "Only accepted students can review this tuition." });
  const tuitions = db.collection("tuitions");
  const tuition = await tuitions.findOne({ _id: new ObjectId(tuitionId) });
  if (!tuition) return res.status(404).json({ message: "Tuition not found." });
  if (tuition.reviews?.some((review) => review.studentEmail === req.user.email)) {
    return res.status(409).json({ message: "You have already reviewed this tuition." });
  }
  await tuitions.updateOne(
    { _id: tuition._id },
    { $push: { reviews: {
      studentEmail: req.user.email,
      studentName: req.user.name,
      rating,
      feedback: String(req.body.feedback || ""),
      createdAt: new Date(),
    } } },
  );
  res.status(201).json({ success: true });
});

export default router;
