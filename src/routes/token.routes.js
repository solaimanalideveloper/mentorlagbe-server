import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import jwt from "jsonwebtoken";
import { getAuth } from "../config/auth.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({ message: "Sign in to get an API token." });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required to issue API tokens.");
    }

    const token = jwt.sign(
      {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    return res.json({ token });
  } catch (error) {
    return next(error);
  }
});

export default router;
