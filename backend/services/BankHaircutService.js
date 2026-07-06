/**
 * BankHaircutService — bank-determined Haircut policy for Token Discounting
 * (true-sale) requests.
 *
 * Business rule: the customer does NOT choose the Haircut — the receiving
 * bank does, based on its own internal risk policy for agricultural-
 * commodity collateral (coffee-backed RWA tokens). Haircut stays within
 * 30–40% (disbursement 60–70%) across all partner banks in this demo model.
 *
 * This module is the single source of truth for that policy. Swap the body
 * of listBanks()/getBankHaircut() for a DB query or a partner-bank API call
 * later — no call site (controller or frontend, which consumes these via
 * GET /api/finance/banks) needs to change.
 */

const BANK_HAIRCUTS = [
  { name: 'Agribank',    haircut: 0.30 },
  { name: 'VietinBank',  haircut: 0.31 },
  { name: 'BIDV',        haircut: 0.32 },
  { name: 'VPBank',      haircut: 0.35 },
  { name: 'Techcombank', haircut: 0.37 },
  { name: 'HDBank',      haircut: 0.34 },
  { name: 'MSB',         haircut: 0.40 },
];

function toPolicy(bank) {
  return { name: bank.name, haircut: bank.haircut, disbursementRatio: 1 - bank.haircut };
}

/** All partner banks and their current Haircut policy. */
export function listBanks() {
  return BANK_HAIRCUTS.map(toPolicy);
}

/** Look up a single bank's policy by name, or null if not a supported partner bank. */
export function getBankHaircut(bankName) {
  const bank = BANK_HAIRCUTS.find(b => b.name === bankName);
  return bank ? toPolicy(bank) : null;
}
