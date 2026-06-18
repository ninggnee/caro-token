import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,

  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
});

// Prevent MaxListenersExceededWarning when many concurrent requests queue on the pool
pool.setMaxListeners(30);

export default pool;