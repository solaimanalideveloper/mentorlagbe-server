import { MongoClient } from "mongodb";

let mongoClient;
let connectionPromise;

export const getDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required to access the database");
  }

  if (!connectionPromise) {
    mongoClient = new MongoClient(uri);
    connectionPromise = mongoClient.connect().catch((error) => {
      mongoClient = undefined;
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
  return mongoClient.db(process.env.DB_NAME || "mentorlagbe");
};
