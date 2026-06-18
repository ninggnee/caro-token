import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import path    from 'path';
import fs      from 'fs';

import authRoutes       from './routes/authRoutes.js';
import kycRoutes        from './routes/kycRoutes.js';
import kycAdminRoutes   from './routes/kycAdminRoutes.js';
import adminUsersRoutes from './routes/adminUsersRoutes.js';
import adminSummaryRoutes from './routes/adminSummaryRoutes.js';
import tokenRoutes      from './routes/tokenRoutes.js';
import marketRoutes     from './routes/marketRoutes.js';
import redeemRoutes     from './routes/redeemRoutes.js';
import migrateRoutes    from './routes/migrateRoutes.js';
import adminSetupRoutes from './routes/adminSetupRoutes.js';
import orderRoutes      from './routes/orderRoutes.js';
import walletRoutes     from './routes/walletRoutes.js';
import custodianRoutes  from './routes/custodianRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Ensure upload directories exist
['uploads/kyc', 'uploads/deposits'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Static file serving
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/kyc',          kycRoutes);
app.use('/api/admin/kyc',    kycAdminRoutes);
app.use('/api/admin/users',  adminUsersRoutes);
app.use('/api/admin',        adminSummaryRoutes);
app.use('/api/token',        tokenRoutes);
app.use('/api/market',       marketRoutes);       // legacy market (backward compat)
app.use('/api/redeem',       redeemRoutes);
app.use('/api/migrate',      migrateRoutes);
app.use('/api/admin/setup',  adminSetupRoutes);

// ── New routes (Parts 4, 5, 8, 11) ───────────────────────────────────────────
app.use('/api/orders',       orderRoutes);        // matching engine
app.use('/api/wallet',       walletRoutes);       // VND deposit/withdraw
app.use('/api/custodian',    custodianRoutes);    // RWA custodian flow

app.get('/', (_, res) => res.json({ message: 'CaRo Backend Running' }));

// Debug: test DB connection and show table status on startup
import db from './config/db.js';

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  try {
    const [[{ now }]] = await db.execute('SELECT NOW() as now');
    console.log(`✅ DB connected — ${now}`);
    const [tables] = await db.execute(`SHOW TABLES`);
    console.log(`📋 Tables: ${tables.map(t => Object.values(t)[0]).join(', ')}`);
  } catch (err) {
    console.error(`❌ DB connection FAILED: ${err.message}`);
    console.error('   Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env');
  }
});
