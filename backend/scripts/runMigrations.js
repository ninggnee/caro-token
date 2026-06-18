import fs from 'fs';
import path from 'path';
import db from '../config/db.js';

const sqlPath = path.join(process.cwd(), 'migrations', 'init.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  try {
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      try {
        await db.execute(stmt);
      } catch (err) {
        console.error('Statement failed:', stmt.slice(0,200));
        console.error(err);
      }
    }
    console.log('Migrations executed');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
