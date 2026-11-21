import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyStudent } from "../middlewares/verifyStudent.js";
import { verifyTutor } from "../middlewares/verifyTutor.js";

const router = Router();

router.post("/", verifyToken, verifyStudent, async (req, res) => {
  const { tuitionId, studentPhone, preferredSchedule, studentNote } = req.body;
  if (!ObjectId.isValid(tuitionId)) return res.status(400).json({ message: "Invalid tuition id." });

  const db = await getDb();
  const tuition = await db.collection("tuitions").findOne({
    _id: new ObjectId(tuitionId),
    approvalStatus: "approved",
    isActive: true,
  });
  if (!tuition) return res.status(404).json({ message: "Tuition not found or unavailable." });

  try {
    const result = await db.collection("applications").insertOne({
      tuitionId: tuition._id.toString(),
      tuitionTitle: tuition.title,
      subject: tuition.subject,
      monthlyFee: tuition.monthlyFee,
      tutorEmail: tuition.tutorEmail,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentPhone,
      preferredSchedule,
      studentNote,
      status: "pending",
      appliedAt: new Date(),
    });
    res.status(201).json({ _id: result.insertedId });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "You have already applied to this tuition." });
    }
    throw error;
  }
});

router.get("/my", verifyToken, verifyStudent, async (req, res) => {
  const db = await getDb();
  const applications = await db.collection("applications")
    .find({ studentEmail: req.user.email })
    .sort({ appliedAt: -1 })
    .toArray();
  res.json(applications);
});

router.get("/check/:tuitionId", verifyToken, verifyStudent, async (req, res) => {
  if (!ObjectId.isValid(req.params.tuitionId)) return res.status(400).json({ message: "Invalid tuition id." });
  const db = await getDb();
  const application = await db.collection("applications").findOne({
    tuitionId: req.params.tuitionId,
    studentEmail: req.user.email,
  });
  res.json({ applied: Boolean(application) });
});

router.delete("/:id", verifyToken, verifyStudent, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid application id." });
  const db = await getDb();
  const applications = db.collection("applications");
  const application = await applications.findOne({ _id: new ObjectId(req.params.id) });
  if (!application) return res.status(404).json({ message: "Application not found." });
  if (application.studentEmail !== req.user.email) return res.status(403).json({ message: "You do not own this application." });
  if (application.status !== "pending") return res.status(400).json({ message: "Only pending applications can be cancelled." });
  await applications.deleteOne({ _id: application._id });
  res.json({ success: true });
});

router.patch("/:id/status", verifyToken, verifyTutor, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid application id." });
  if (!["accepted", "rejected"].includes(req.body.status)) {
    return res.status(400).json({ message: "Status must be accepted or rejected." });
  }

  const db = await getDb();
  const applications = db.collection("applications");
  const application = await applications.findOne({ _id: new ObjectId(req.params.id) });
  if (!application) return res.status(404).json({ message: "Application not found." });
  if (application.tutorEmail !== req.user.email) return res.status(403).json({ message: "You do not own this application." });

  await applications.updateOne({ _id: application._id }, { $set: { status: req.body.status } });
  res.json({ ...application, status: req.body.status });
});

export default router;
