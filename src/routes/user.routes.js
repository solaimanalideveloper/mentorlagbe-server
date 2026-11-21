import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { getDb } from "../config/db.js";

const router = Router();

router.get("/me", verifyToken, (req, res) => {
  res.json(req.user);
});

router.patch("/me", verifyToken, async (req, res, next) => {
  try {
    const allowed = ["name", "phone", "bio", "image"];
    const update = {};
    for (const field of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        update[field] = req.body[field];
      }
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No allowed profile fields provided." });
    }

    await (await getDb()).collection("users").updateOne(
      { email: req.user.email },
      { $set: update },
    );
    const user = await (await getDb()).collection("users").findOne(
      { email: req.user.email },
      { projection: { name: 1, email: 1, image: 1, role: 1, plan: 1, phone: 1, bio: 1, createdAt: 1 } },
    );
    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

export default router;
