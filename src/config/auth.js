import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getDb } from "./db.js";

let authPromise;

export const getAuth = async () => {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is required for authentication");
  }
  if (!process.env.BETTER_AUTH_URL && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_URL must be configured in production");
  }

  if (!authPromise) {
    authPromise = getDb()
      .then((db) => betterAuth({
        database: mongodbAdapter(db),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8000",
        trustedOrigins: [process.env.CLIENT_URL, "http://localhost:3000"].filter(Boolean),
        emailAndPassword: {
          enabled: true,
        },
        user: {
          modelName: "users",
          additionalFields: {
            role: { type: "string", defaultValue: "student", input: true },
            plan: { type: "string", defaultValue: "free", input: false },
            phone: { type: "string", required: false },
            bio: { type: "string", required: false },
          },
        },
        databaseHooks: {
          user: {
            create: {
              before: async (user) => ({
                data: {
                  ...user,
                  role: user.role === "tutor" ? "tutor" : "student",
                  plan: "free",
                },
              }),
            },
          },
        },
        ...(process.env.NODE_ENV === "production" && {
          advanced: {
            defaultCookieAttributes: {
              sameSite: "none",
              secure: true,
            },
          },
        }),
      }))
      .catch((error) => {
        authPromise = undefined;
        throw error;
      });
  }

  return authPromise;
};
