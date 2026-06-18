import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/run', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const sqlPath = path.join(process.cwd(), 'migrations', 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await db.execute(stmt);
      } catch (err) {
        console.error('Statement failed:', stmt.slice(0,200));
        console.error(err);
      }
    }
    res.json({ success: true, message: 'Migrations executed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Migration failed' });
  }
});

export default router;
