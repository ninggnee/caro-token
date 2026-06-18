import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
  console.error("Usage: node loginUser.js --email <email> --password <password>");
  process.exit(1);
}

const run = async () => {
  try {
    const [users] = await db.execute(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      console.error("User not found");
      process.exit(2);
    }

    const user = users[0];

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      console.error("Wrong password");
      process.exit(3);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    console.log(JSON.stringify({ success: true, token, user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      wallet_address: user.wallet_address,
      kyc_status: user.kyc_status,
    } }, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
