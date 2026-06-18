import express from 'express';
import fs      from 'fs';
import path    from 'path';
import db      from '../config/db.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  // Split on statement-ending semicolons; skip comment-only blocks
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  const results = [];
  for (const stmt of statements) {
    try {
      await db.execute(stmt);
      results.push({ ok: true, preview: stmt.slice(0, 60) });
    } catch (err) {
      results.push({ ok: false, preview: stmt.slice(0, 60), error: err.message });
      console.error('Migration stmt failed:', stmt.slice(0, 200), err.message);
    }
  }
  return results;
}

// POST /api/migrate/run — run init.sql (legacy bootstrap)
router.post('/run', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const sqlPath = path.join(process.cwd(), 'migrations', 'init.sql');
    const results = await runSqlFile(sqlPath);
    res.json({ success: true, message: 'init.sql executed', results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/migrate/v2 — run full_migration.sql + asset_batch_v2.sql
router.post('/v2', verifyToken, requireRole('admin'), async (req, res) => {
  const files = [
    path.join(process.cwd(), '..', 'sql', 'migrations', 'full_migration.sql'),
    path.join(process.cwd(), '..', 'sql', 'migrations', 'asset_batch_v2.sql'),
  ];

  const allResults = [];
  for (const f of files) {
    if (!fs.existsSync(f)) {
      allResults.push({ file: f, skipped: true, reason: 'file not found' });
      continue;
    }
    const results = await runSqlFile(f);
    allResults.push({ file: path.basename(f), results });
  }

  res.json({ success: true, message: 'v2 migrations executed', allResults });
});

export default router;
