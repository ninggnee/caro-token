/**
 * Sync user_balances DB to match on-chain balances from new CoffeeToken contracts.
 *
 * Usage:
 *   node scripts/syncOnChainBalances.js          # dry-run: shows what would change
 *   node scripts/syncOnChainBalances.js --apply  # applies changes to DB
 */

import { ethers } from 'ethers';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const APPLY = process.argv.includes('--apply');

const TOKEN_TYPES = ['CR1', 'CR2', 'CR3'];
const CONTRACT_MAP = {
  CR1: process.env.CA_RO_CR1,
  CR2: process.env.CA_RO_CR2,
  CR3: process.env.CA_RO_CR3,
};

const BALANCE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function main() {
  console.log(`\n=== CaRo Token On-Chain Sync — Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} ===\n`);

  const db = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  console.log('✅ DB connected');

  const rpc = process.env.ETH_RPC_URL || process.env.RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpc);
  console.log(`✅ RPC: ${rpc}\n`);

  // Load each contract and detect decimals once
  const contracts  = {};
  const decimalsOf = {};
  for (const [type, addr] of Object.entries(CONTRACT_MAP)) {
    if (!addr) {
      console.warn(`⚠️  ${type}: CA_RO_${type} not set in .env — skipping`);
      continue;
    }
    contracts[type]  = new ethers.Contract(addr, BALANCE_ABI, provider);
    decimalsOf[type] = Number(await contracts[type].decimals().catch(() => 18n));
    console.log(`📄 ${type}: ${addr}  (decimals=${decimalsOf[type]})`);
  }
  console.log('');

  // Only farmers can have on-chain tokens minted
  const [farmers] = await db.execute(
    `SELECT id, email, full_name, wallet_address FROM users
     WHERE role = 'farmer' AND wallet_address IS NOT NULL AND wallet_address != ''`
  );
  console.log(`👥 ${farmers.length} farmer(s) with registered wallets\n`);

  let totalUpdated = 0;
  let totalErrors  = 0;

  for (const farmer of farmers) {
    const label = `${farmer.email}  (${farmer.wallet_address.slice(0, 10)}...)`;
    console.log(`── ${label} ──`);

    for (const tokenType of TOKEN_TYPES) {
      const contract = contracts[tokenType];
      if (!contract) {
        console.log(`   [${tokenType}] SKIP — contract not configured`);
        continue;
      }

      let rawBal;
      try {
        rawBal = await contract.balanceOf(farmer.wallet_address);
      } catch (err) {
        console.error(`   [${tokenType}] ❌ RPC error: ${err.message}`);
        totalErrors++;
        continue;
      }

      const onChainNum = parseFloat(ethers.formatUnits(rawBal, decimalsOf[tokenType]));

      const [rows] = await db.execute(
        `SELECT balance, available_balance, locked_balance
         FROM user_balances WHERE user_id = ? AND token_type = ?`,
        [farmer.id, tokenType]
      );
      const dbRow    = rows[0];
      const dbBal    = dbRow ? parseFloat(dbRow.balance)        : 0;
      const dbLocked = dbRow ? parseFloat(dbRow.locked_balance) : 0;

      const changed = Math.abs(onChainNum - dbBal) > 0.000001;

      if (changed) {
        console.log(`   ✏️  [${tokenType}]  DB=${dbBal}  →  on-chain=${onChainNum}`);
        totalUpdated++;

        if (APPLY) {
          const newLocked    = Math.min(dbLocked, onChainNum);
          const newAvailable = Math.max(0, onChainNum - newLocked);

          await db.execute(
            `INSERT INTO user_balances
               (user_id, token_type, balance, available_balance, locked_balance)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               balance           = VALUES(balance),
               available_balance = VALUES(available_balance),
               locked_balance    = VALUES(locked_balance)`,
            [farmer.id, tokenType, onChainNum, newAvailable, newLocked]
          );
        }
      } else {
        console.log(`   ✓   [${tokenType}]  ${onChainNum}  (matches)`);
      }
    }
    console.log('');
  }

  await db.end();

  console.log('=== SUMMARY ===');
  if (APPLY) {
    console.log(`✅ Updated:  ${totalUpdated} record(s)`);
    console.log(`❌ Errors:   ${totalErrors}`);
    console.log('\nDone. user_balances now reflects on-chain state from the new contracts.');
  } else {
    console.log(`📝 Would update: ${totalUpdated} record(s)`);
    console.log(`❌ Errors:       ${totalErrors}`);
    console.log('\nDry-run complete. Re-run with --apply to write changes.');
  }
}

main().catch(err => {
  console.error('\n❌ FATAL:', err.message);
  process.exit(1);
});
