import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes       from './routes/authRoutes.js';
import kycRoutes        from './routes/kycRoutes.js';
import kycAdminRoutes   from './routes/kycAdminRoutes.js';
import adminUsersRoutes from './routes/adminUsersRoutes.js';
import adminSummaryRoutes from './routes/adminSummaryRoutes.js';
import adminLogsRoutes from './routes/adminLogsRoutes.js';
import tokenRoutes      from './routes/tokenRoutes.js';
import marketRoutes     from './routes/marketRoutes.js';
import redeemRoutes     from './routes/redeemRoutes.js';
import migrateRoutes    from './routes/migrateRoutes.js';
import adminSetupRoutes from './routes/adminSetupRoutes.js';
import orderRoutes      from './routes/orderRoutes.js';
import walletRoutes     from './routes/walletRoutes.js';
import custodianRoutes         from './routes/custodianRoutes.js';
import assetBatchRoutes        from './routes/assetBatchRoutes.js';
import warehouseDocumentRoutes from './routes/warehouseDocumentRoutes.js';
import mockMarketRoutes        from './routes/mockMarketRoutes.js';
import MockMarketEngine        from './services/MockMarketEngine.js';
import farmerRoutes            from './routes/farmerDashboardRoutes.js';
import adminSyncRoutes         from './routes/adminSyncRoutes.js';
import financeRoutes           from './routes/financeRoutes.js';
import lcRoutes                from './routes/lcRoutes.js';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

app.use(cors());
app.use(express.json());

// Ensure upload directories exist
['uploads/kyc', 'uploads/deposits', 'uploads/batches', 'uploads/warehouse-docs'].forEach(dir => {
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
app.use('/api/admin/logs',   adminLogsRoutes);
app.use('/api/token',        tokenRoutes);
app.use('/api/market',       mockMarketRoutes);   // mock market engine (MARKET_MODE=MOCK)
app.use('/api/market-legacy', marketRoutes);     // legacy market (kept for backward compat)
app.use('/api/redeem',       redeemRoutes);
app.use('/api/migrate',      migrateRoutes);
app.use('/api/admin/setup',  adminSetupRoutes);
app.use('/api/admin/sync',   adminSyncRoutes);            // On-chain balance sync
app.use('/api/finance',      financeRoutes);              // Trader finance (collateral loan + token discounting)
app.use('/api/lc',           lcRoutes);                   // Digital L/C (nhận nông sản thực tế)

// ── New routes (Parts 4, 5, 8, 11) ───────────────────────────────────────────
app.use('/api/orders',       orderRoutes);        // matching engine
app.use('/api/wallet',       walletRoutes);       // VND deposit/withdraw
app.use('/api/custodian',            custodianRoutes);         // RWA custodian flow
app.use('/api/batches',             assetBatchRoutes);         // Asset batch mint workflow
app.use('/api/warehouse-documents', warehouseDocumentRoutes);  // Warehouse document IPFS storage
app.use('/api/farmer',             farmerRoutes);              // Farmer dashboard & token holdings

app.get('/', (_, res) => res.json({ message: 'CaRo Backend Running' }));

// Debug: test DB connection and show table status on startup
import db from './config/db.js';


// Auto-apply v6 migration (ensures wallet/deposit/withdraw tables exist with full columns).
async function applyV6Migration() {
  try {
    console.log('⏳ Applying v6 migration (wallet schema)...');
    const sqlPath = path.join(__dirname, 'migrations', 'v6_wallet_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const stmts = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      try { await db.execute(stmt); } catch (e) {
        // Duplicate column errors are expected on re-runs — suppress them
        if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
          console.warn(`  ⚠️  v6 stmt warning: ${e.message.slice(0, 120)}`);
        }
      }
    }
    console.log('✅ v6 migration applied');
  } catch (err) {
    console.warn('⚠️  v6 migration check failed (non-fatal):', err.message);
  }
}

// Auto-apply v4 migration (finance tables).
async function applyV4Migration() {
  try {
    const [[cl]] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collateral_loans' LIMIT 1`
    );
    if (cl) {
      console.log('✅ v4 migration already applied — skipping');
      return;
    }
    console.log('⏳ Applying v4 migration (finance tables)...');
    const sqlPath = path.join(__dirname, 'migrations', 'v4_finance_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const stmts = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim()).filter(s => s.length > 0);
    for (const stmt of stmts) {
      try { await db.execute(stmt); } catch (e) {
        console.warn(`  ⚠️  v4 stmt warning: ${e.message.slice(0, 120)}`);
      }
    }
    console.log('✅ v4 migration applied');
  } catch (err) {
    console.warn('⚠️  v4 migration check failed (non-fatal):', err.message);
  }
}

// Auto-apply v5 migration (adds 'market' to orders.type ENUM + trade FK columns).
// Checks if 'market' is already in orders.type ENUM — skips if so.
async function applyV5Migration() {
  try {
    const [[col]] = await db.execute(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'type'`
    );
    if (!col || col.COLUMN_TYPE.includes('market')) {
      console.log('✅ v5 migration already applied — skipping');
      return;
    }
    console.log('⏳ Applying v5 migration (order status ENUM + trade FK columns)...');
    const sqlPath = path.join(__dirname, 'migrations', 'v5_order_status_ptm.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const stmts = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    for (const stmt of stmts) {
      try {
        await db.execute(stmt);
      } catch (e) {
        // "Duplicate column name" is OK if trade columns already exist
        if (!e.message.includes('Duplicate column')) {
          console.warn(`  ⚠️  v5 stmt warning: ${e.message.slice(0, 120)}`);
        }
      }
    }
    console.log('✅ v5 migration applied');
  } catch (err) {
    console.warn('⚠️  v5 migration check failed (non-fatal):', err.message);
  }
}

// Auto-apply v10 migration (collateral_loans/token_discounting lifecycle
// columns: rejection_reason, disbursement_id).
// Checks if 'rejection_reason' already exists on collateral_loans — skips if so.
async function applyV10Migration() {
  try {
    const [[col]] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collateral_loans' AND COLUMN_NAME = 'rejection_reason'`
    );
    if (col) {
      console.log('✅ v10 migration already applied — skipping');
      return;
    }
    console.log('⏳ Applying v10 migration (finance lifecycle columns)...');
    const sqlPath = path.join(__dirname, 'migrations', 'v10_finance_lifecycle.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const stmts = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);
    for (const stmt of stmts) {
      try {
        await db.execute(stmt);
      } catch (e) {
        if (!e.message.includes('Duplicate column')) {
          console.warn(`  ⚠️  v10 stmt warning: ${e.message.slice(0, 120)}`);
        }
      }
    }
    console.log('✅ v10 migration applied');
  } catch (err) {
    console.warn('⚠️  v10 migration check failed (non-fatal):', err.message);
  }
}

// Auto-apply v11 migration (L/C contracts module).
// Checks if the 'lc_contracts' table already exists — skips if so.
async function applyV11Migration() {
  try {
    const [[tbl]] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lc_contracts'`
    );
    if (tbl) {
      console.log('✅ v11 migration already applied — skipping');
      return;
    }
    console.log('⏳ Applying v11 migration (L/C contracts)...');
    const sqlPath = path.join(__dirname, 'migrations', 'v11_lc_contracts.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const stmts = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);
    for (const stmt of stmts) {
      try {
        await db.execute(stmt);
      } catch (e) {
        if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
          console.warn(`  ⚠️  v11 stmt warning: ${e.message.slice(0, 120)}`);
        }
      }
    }
    console.log('✅ v11 migration applied');
  } catch (err) {
    console.warn('⚠️  v11 migration check failed (non-fatal):', err.message);
  }
}

// Auto-apply v12 migration (L/C payment-method refactor).
// Checks if the 'payment_method' column already exists on lc_contracts.
async function applyV12Migration() {
  try {
    const [[col]] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lc_contracts' AND COLUMN_NAME = 'payment_method'`
    );
    if (col) {
      console.log('✅ v12 migration already applied — skipping');
      return;
    }
    console.log('⏳ Applying v12 migration (L/C payment method)...');
    const sqlPath = path.join(__dirname, 'migrations', 'v12_lc_payment_method.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const stmts = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);
    for (const stmt of stmts) {
      try {
        await db.execute(stmt);
      } catch (e) {
        if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
          console.warn(`  ⚠️  v12 stmt warning: ${e.message.slice(0, 120)}`);
        }
      }
    }
    console.log('✅ v12 migration applied');
  } catch (err) {
    console.warn('⚠️  v12 migration check failed (non-fatal):', err.message);
  }
}

// Auto-apply v13 migration (L/C ready-to-close step).
// Checks if the 'oracle_completion_status' column already exists on lc_contracts.
async function applyV13Migration() {
  try {
    const [[col]] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lc_contracts' AND COLUMN_NAME = 'oracle_completion_status'`
    );
    if (col) {
      console.log('✅ v13 migration already applied — skipping');
      return;
    }
    console.log('⏳ Applying v13 migration (L/C ready-to-close)...');
    const sqlPath = path.join(__dirname, 'migrations', 'v13_lc_ready_to_close.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const stmts = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);
    for (const stmt of stmts) {
      try {
        await db.execute(stmt);
      } catch (e) {
        if (!e.message.includes('Duplicate column') && !e.message.includes('already exists')) {
          console.warn(`  ⚠️  v13 stmt warning: ${e.message.slice(0, 120)}`);
        }
      }
    }
    console.log('✅ v13 migration applied');
  } catch (err) {
    console.warn('⚠️  v13 migration check failed (non-fatal):', err.message);
  }
}

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

  await applyV4Migration();
  await applyV6Migration();
  await applyV5Migration();
  await applyV10Migration();
  await applyV11Migration();
  await applyV12Migration();
  await applyV13Migration();

  // Start mock market engine unless explicitly in LIVE mode
  if (process.env.MARKET_MODE !== 'LIVE') {
    try {
      await MockMarketEngine.initialize();
      MockMarketEngine.start();
    } catch (err) {
      console.warn('⚠️  MockMarketEngine failed to start:', err.message);
    }
  }

  // Start the Logistics Simulation Daemon
  import('./services/SimulationDaemon.js').then(daemon => {
    daemon.startDaemon();
  }).catch(err => {
    console.error('⚠️ SimulationDaemon failed to start:', err);
  });
});
