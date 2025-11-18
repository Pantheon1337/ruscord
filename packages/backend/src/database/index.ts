import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";
import { createTables } from "./schema";

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "ruscord",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log("Executed query", { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

export const initDatabase = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("Database connection established");
    await createTables();
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

export default pool;

