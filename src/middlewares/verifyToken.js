import jwt from "jsonwebtoken";
import { getDb } from "../config/db.js";

const unauthorized = (res) => res.status(401).json({ message: "Invalid or missing token." });

export const verifyToken = async (req, res, next) => {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return unauthorized(res);
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error("JWT_SECRET is required to verify API tokens."));
  }

  let claims;
  try {
    claims = jwt.verify(match[1], process.env.JWT_SECRET);
  } catch {
    return unauthorized(res);
  }

  if (!claims || typeof claims !== "object" || typeof claims.email !== "string") {
    return unauthorized(res);
  }

  try {
    const user = await (await getDb()).collection("users").findOne(
      { email: claims.email },
      {
        projection: {
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          plan: 1,
          phone: 1,
          bio: 1,
          createdAt: 1,
        },
      },
    );

    if (!user) {
      return unauthorized(res);
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
