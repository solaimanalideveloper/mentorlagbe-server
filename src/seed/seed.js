import "dotenv/config";
import { getDb } from "../config/db.js";
import { getAuth } from "../config/auth.js";

const password = "MentorLagbe123!";

const accounts = [
  { name: "MentorLagbe Admin", email: "admin@mentorlagbe.test", role: "admin" },
  { name: "Rahim Tutor", email: "rahim.tutor@mentorlagbe.test", role: "tutor" },
  { name: "Nusrat Tutor", email: "nusrat.tutor@mentorlagbe.test", role: "tutor" },
  { name: "Arif Student", email: "arif.student@mentorlagbe.test", role: "student" },
  { name: "Sadia Student", email: "sadia.student@mentorlagbe.test", role: "student" },
];

const tuitions = [
  ["SSC Mathematics Foundation", "Mathematics", "SSC", "Online", "Dhaka", 4200],
  ["HSC Physics Intensive", "Physics", "HSC", "Offline", "Dhaka", 5200],
  ["Chemistry Concept Booster", "Chemistry", "HSC", "Online", "Chattogram", 4800],
  ["Biology for Medical Entry", "Biology", "HSC", "Offline", "Sylhet", 5500],
  ["Spoken English Practice", "English", "Class 6-10", "Online", "Dhaka", 3500],
  ["IELTS Writing Mastery", "IELTS", "Professional", "Online", "Dhaka", 6500],
  ["Programming with JavaScript", "Programming", "University", "Online", "Dhaka", 7000],
  ["ICT Problem Solving", "ICT", "SSC", "Offline", "Rajshahi", 4000],
  ["Bangla Grammar and Composition", "Bangla", "Class 8-10", "Offline", "Dhaka", 3600],
  ["Accounting for Beginners", "Accounting", "HSC", "Online", "Chattogram", 4500],
  ["University Calculus Support", "Mathematics", "University", "Online", "Dhaka", 6000],
  ["Class 6-7 Science Fundamentals", "Science", "Class 6-7", "Offline", "Sylhet", 3300],
];

const db = await getDb();
const auth = await getAuth();

for (const account of accounts) {
  try {
    await auth.api.signUpEmail({
      body: { name: account.name, email: account.email, password },
      headers: new Headers(),
    });
  } catch {
    // Account may already exist on rerun.
  }
  await db.collection("users").updateOne(
    { email: account.email },
    { $set: { name: account.name, role: account.role, plan: "free" } },
    { upsert: false },
  );
}

for (let index = 0; index < tuitions.length; index += 1) {
  const [title, subject, classLevel, mode, location, monthlyFee] = tuitions[index];
  const tutorEmail = index % 2 === 0 ? accounts[1].email : accounts[2].email;
  const tutorName = index % 2 === 0 ? accounts[1].name : accounts[2].name;
  await db.collection("tuitions").updateOne(
    { title },
    {
      $set: {
        title,
        subject,
        classLevel,
        mode,
        location,
        monthlyFee,
        daysPerWeek: 3,
        bannerImage: `https://images.unsplash.com/photo-${1500000000000 + index}?auto=format&fit=crop&w=1200&q=80`,
        description: `Expert ${subject} tuition for ${classLevel} students with practical lessons and regular assessment.`,
        tutorName,
        tutorEmail,
        approvalStatus: "approved",
        isActive: true,
        createdAt: new Date(Date.now() - index * 86400000),
      },
    },
    { upsert: true },
  );
}

await db.collection("tuitions").updateOne(
  { title: "Pending English Enrollment" },
  {
    $set: {
      title: "Pending English Enrollment",
      subject: "English",
      classLevel: "Class 9",
      mode: "Offline",
      location: "Dhaka",
      monthlyFee: 3800,
      daysPerWeek: 3,
      bannerImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b",
      description: "Pending moderation sample tuition.",
      tutorName: accounts[1].name,
      tutorEmail: accounts[1].email,
      approvalStatus: "pending",
      isActive: true,
      createdAt: new Date(),
    },
  },
  { upsert: true },
);

const seededTuition = await db.collection("tuitions").findOne({ title: tuitions[0][0] });
if (seededTuition) {
  await db.collection("applications").updateOne(
    { tuitionId: seededTuition._id.toString(), studentEmail: accounts[3].email },
    {
      $set: {
        tuitionId: seededTuition._id.toString(),
        tuitionTitle: seededTuition.title,
        subject: seededTuition.subject,
        monthlyFee: seededTuition.monthlyFee,
        tutorEmail: seededTuition.tutorEmail,
        studentName: accounts[3].name,
        studentEmail: accounts[3].email,
        studentPhone: "01700000000",
        preferredSchedule: "Friday evening",
        studentNote: "I want to prepare for my final exam.",
        status: "accepted",
        appliedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

await db.collection("payments").updateOne(
  { stripeSessionId: "seeded_session_student" },
  {
    $set: {
      userEmail: accounts[3].email,
      userName: accounts[3].name,
      userRole: "student",
      planName: "pro",
      amount: 10,
      currency: "usd",
      transactionId: "seeded_transaction_student",
      stripeSessionId: "seeded_session_student",
      paymentStatus: "paid",
      paidAt: new Date(),
    },
  },
  { upsert: true },
);

console.log("Seed completed. Login password:", password);
process.exit(0);
