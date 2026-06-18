import db from "../config/db.js";

const check = async () => {
  try {
    const [rows] = await db.execute(
      `SELECT id, email, role, full_name, kyc_status FROM users WHERE role = ?`,
      ["admin"]
    );

    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

check();
