import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import db from "../config/db.js";

dotenv.config();

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : fallback;
};

const email = getArg("email", null);
const password = getArg("password", null);

if (!email || !password) {
  console.error("Usage: node updatePassword.js --email <email> --password <newPassword>");
  process.exit(1);
}

const run = async () => {
  try {
    const password_hash = await bcrypt.hash(password, 10);

    const [res] = await db.execute(
      `UPDATE users SET password_hash = ? WHERE email = ?`,
      [password_hash, email]
    );

    console.log(`Updated password for ${email}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
