import fs from 'fs';
import path from 'path';
import db from '../config/db.js';

async function seed(userId) {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'kyc');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const frontName = `dummy-front-${Date.now()}.png`;
    const backName = `dummy-back-${Date.now()}.png`;
    fs.writeFileSync(path.join(uploadsDir, frontName), 'dummy');
    fs.writeFileSync(path.join(uploadsDir, backName), 'dummy');

    const frontPath = `/uploads/kyc/${frontName}`;
    const backPath = `/uploads/kyc/${backName}`;

    try {
      const [res] = await db.execute(`INSERT INTO kyc_requests (user_id, front_path, back_path, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`, [userId, frontPath, backPath]);
      console.log('Inserted kyc id=', res.insertId);
    } catch (e) {
      // fallback for alternative schema
      const [res] = await db.execute(`INSERT INTO kyc_requests (user_id, document_front, document_back, status, created_at) VALUES (?, ?, ?, 'pending', NOW())`, [userId, frontPath, backPath]);
      console.log('Inserted kyc id (alt)=', res.insertId);
    }
    await db.execute(`UPDATE users SET kyc_status = 'pending' WHERE id = ?`, [userId]);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/seedKyc.js <userId>');
  process.exit(1);
}

seed(userId);
