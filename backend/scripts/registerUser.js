import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import db from "../config/db.js";

dotenv.config();

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : fallback;
};

const email = getArg("email", "testuser@example.com");
const password = getArg("password", "Password123!");
const full_name = getArg("full_name", "Test User");
const role = getArg("role", "trader");

const run = async () => {
  try {
    const [existing] = await db.execute(
      `SELECT id FROM users WHERE email = ?`,
      [email]
    );

    if (existing.length > 0) {
      console.log("User already exists:", email);
      process.exit(0);
    }

    const password_hash = await bcrypt.hash(password, 10);

    await db.execute(
      `
      INSERT INTO users
      (email, password_hash, full_name, role, kyc_status)
      VALUES (?, ?, ?, ?, 'pending')
      `,
      [email, password_hash, full_name, role]
    );

    console.log("Inserted user:", email);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
