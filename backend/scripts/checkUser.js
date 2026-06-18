import dotenv from "dotenv";
import db from "../config/db.js";

dotenv.config();

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : fallback;
};

const email = getArg("email", null);
const role = getArg("role", null);

const run = async () => {
  try {
    if (email) {
      const [rows] = await db.execute(`SELECT * FROM users WHERE email = ?`, [email]);
      console.log(JSON.stringify(rows, null, 2));
      process.exit(0);
    }

    if (role) {
      const [rows] = await db.execute(`SELECT id, email, full_name, kyc_status FROM users WHERE role = ?`, [role]);
      console.log(JSON.stringify(rows, null, 2));
      process.exit(0);
    }

    const [rows] = await db.execute(`SELECT id, email, role, full_name, kyc_status FROM users LIMIT 50`);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
