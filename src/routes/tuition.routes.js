import { Router } from "express";
import { getDb } from "../config/db.js";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyTutor } from "../middlewares/verifyTutor.js";

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

router.get("/filters", async (req, res) => {
  const db = await getDb();
  const tuitions = db.collection("tuitions");
  const base = { approvalStatus: "approved", isActive: true };
  const [subjects, classLevels] = await Promise.all([
    tuitions.distinct("subject", base),
    tuitions.distinct("classLevel", base),
  ]);
  res.json({ subjects, classLevels });
});

router.get("/", async (req, res) => {
  const db = await getDb();
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 9, 1), 24);
  const filter = { approvalStatus: "approved", isActive: true };

  if (req.query.q) {
    const escaped = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { subject: { $regex: escaped, $options: "i" } },
    ];
  }
  for (const field of ["subject", "classLevel", "mode"]) {
    if (req.query[field]) {
      filter[field] = String(req.query[field]);
    }
  }

  const tuitions = db.collection("tuitions");
  const [data, total] = await Promise.all([
    tuitions.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    tuitions.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
});

router.post("/", verifyToken, verifyTutor, async (req, res) => {
  const db = await getDb();
  const tuitions = db.collection("tuitions");
  if (req.user.plan !== "pro") {
    const count = await tuitions.countDocuments({ tutorEmail: req.user.email });
    if (count >= 2) {
      return res.status(403).json({ message: "Free tutors can create at most 2 tuitions. Upgrade to Pro for unlimited listings." });
    }
  }

  const allowed = ["title", "subject", "classLevel", "mode", "location", "monthlyFee", "daysPerWeek", "bannerImage", "description"];
  const data = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) data[field] = req.body[field];
  }
  if (!data.title || !data.subject || !data.classLevel || !["Online", "Offline"].includes(data.mode)) {
    return res.status(400).json({ message: "title, subject, classLevel, and a valid mode are required." });
  }

  const result = await tuitions.insertOne({
    ...data,
    tutorName: req.user.name,
    tutorEmail: req.user.email,
    approvalStatus: "pending",
    isActive: true,
    createdAt: new Date(),
  });
  res.status(201).json({ ...data, _id: result.insertedId });
});

router.get("/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid tuition id." });
  }
  const db = await getDb();
  const tuition = await db.collection("tuitions").findOne({
    _id: new ObjectId(req.params.id),
    approvalStatus: "approved",
    isActive: true,
  });
  if (!tuition) return res.status(404).json({ message: "Tuition not found." });
  res.json(tuition);
});

router.patch("/:id/toggle-active", verifyToken, verifyTutor, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid tuition id." });
  const db = await getDb();
  const tuitions = db.collection("tuitions");
  const tuition = await tuitions.findOne({ _id: new ObjectId(req.params.id) });
  if (!tuition) return res.status(404).json({ message: "Tuition not found." });
  if (tuition.tutorEmail !== req.user.email) return res.status(403).json({ message: "You do not own this tuition." });
  await tuitions.updateOne({ _id: tuition._id }, { $set: { isActive: !tuition.isActive } });
  res.json({ isActive: !tuition.isActive });
});

router.patch("/:id", verifyToken, verifyTutor, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid tuition id." });
  const db = await getDb();
  const tuitions = db.collection("tuitions");
  const tuition = await tuitions.findOne({ _id: new ObjectId(req.params.id) });
  if (!tuition) return res.status(404).json({ message: "Tuition not found." });
  if (tuition.tutorEmail !== req.user.email) return res.status(403).json({ message: "You do not own this tuition." });

  const allowed = ["title", "subject", "classLevel", "mode", "location", "monthlyFee", "daysPerWeek", "bannerImage", "description"];
  const update = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) update[field] = req.body[field];
  }
  if (!Object.keys(update).length) return res.status(400).json({ message: "No allowed fields provided." });
  if (tuition.approvalStatus === "approved") update.approvalStatus = "pending";
  await tuitions.updateOne({ _id: tuition._id }, { $set: update });
  res.json({ ...tuition, ...update });
});

router.delete("/:id", verifyToken, verifyTutor, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid tuition id." });
  const db = await getDb();
  const tuitions = db.collection("tuitions");
  const tuition = await tuitions.findOne({ _id: new ObjectId(req.params.id) });
  if (!tuition) return res.status(404).json({ message: "Tuition not found." });
  if (tuition.tutorEmail !== req.user.email) return res.status(403).json({ message: "You do not own this tuition." });
  await db.collection("applications").deleteMany({ tuitionId: tuition._id.toString(), status: "pending" });
  await tuitions.deleteOne({ _id: tuition._id });
  res.json({ success: true });
});

export default router;
