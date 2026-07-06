/**
 * LCPartnerBankService — deferred-payment ("Mua trả chậm") plan catalogue
 * for L/C ("Nhận nông sản thực tế") contracts.
 *
 * Mirrors BankHaircutService.js's pattern: the customer picks a partner
 * bank + one of that bank's fixed financing plans; the plan's `days`
 * determines the contract's due_date. Swap the body of listPartnerBanks()/
 * getPlan() for a DB query or partner-bank API call later — no call site
 * (controller or frontend, which consumes these via GET /api/lc/partner-banks)
 * needs to change.
 */

const PARTNER_BANKS = [
  {
    name: 'Techcombank',
    plans: [
      { key: 'tcb_30d', label: 'Trả sau 30 ngày', days: 30 },
      { key: 'tcb_60d', label: 'Trả sau 60 ngày', days: 60 },
      { key: 'tcb_90d', label: 'Trả sau 90 ngày', days: 90 },
    ],
  },
  {
    name: 'Vietcombank',
    plans: [
      { key: 'vcb_3ky',  label: 'Trả góp 3 kỳ',  days: 90 },
      { key: 'vcb_6ky',  label: 'Trả góp 6 kỳ',  days: 180 },
      { key: 'vcb_12ky', label: 'Trả góp 12 kỳ', days: 360 },
    ],
  },
  {
    name: 'BIDV',
    plans: [
      { key: 'bidv_tf180', label: 'Trade Finance 180 ngày', days: 180 },
    ],
  },
];

/** All partner banks and their available deferred-payment plans. */
export function listPartnerBanks() {
  return PARTNER_BANKS.map(b => ({ name: b.name, plans: b.plans.map(p => ({ ...p })) }));
}

/** Look up a single (bank, plan) pair, or null if not a supported combination. */
export function getPlan(bankName, planKey) {
  const bank = PARTNER_BANKS.find(b => b.name === bankName);
  const plan = bank?.plans.find(p => p.key === planKey);
  return plan ? { bankName: bank.name, ...plan } : null;
}
