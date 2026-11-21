import { MongoClient } from "mongodb";

let mongoClient;
let connectionPromise;

let indexesReady;

const hasIndexKey = async (collection, key) => {
  try {
    const indexes = await collection.listIndexes().toArray();
    return indexes.some((index) => JSON.stringify(index.key) === JSON.stringify(key));
  } catch (error) {
    if (error?.codeName === "NamespaceNotFound" || error?.code === 26) {
      return false;
    }
    throw error;
  }
};

const ensureIndexes = async (db) => {
  const users = db.collection("users");
  if (!await hasIndexKey(users, { email: 1 })) {
    await users.createIndex({ email: 1 }, { unique: true });
  }

  const applications = db.collection("applications");
  if (!await hasIndexKey(applications, { tuitionId: 1, studentEmail: 1 })) {
    await applications.createIndex(
      { tuitionId: 1, studentEmail: 1 },
      { unique: true },
    );
  }

  const payments = db.collection("payments");
  if (!await hasIndexKey(payments, { stripeSessionId: 1 })) {
    await payments.createIndex(
      { stripeSessionId: 1 },
      { unique: true, sparse: true },
    );
  }

  const tuitions = db.collection("tuitions");
  const compoundKey = { approvalStatus: 1, isActive: 1, createdAt: -1 };
  if (!await hasIndexKey(tuitions, compoundKey)) {
    await tuitions.createIndex(compoundKey);
  }
  const textKey = { title: "text", subject: "text" };
  if (!await hasIndexKey(tuitions, textKey)) {
    await tuitions.createIndex(textKey);
  }
};

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
  const db = mongoClient.db(process.env.DB_NAME || "mentorlagbe");
  if (!indexesReady) {
    await ensureIndexes(db);
    indexesReady = true;
  }
  return db;
};
