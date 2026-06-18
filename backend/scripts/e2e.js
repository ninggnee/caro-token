import { spawnSync } from 'child_process';

const BASE = 'http://localhost:5000';

async function post(path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function get(path, token) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { headers });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function run() {
  console.log('1) Register Farmer');
  const r1 = await post('/api/auth/register', { full_name: 'E2E Farmer', email: 'farmer_e2e@caro.local', password: 'Farmer123!', role: 'farmer' });
  console.log('  ->', r1.status, r1.body);

  console.log('2) Login Farmer');
  const l1 = await post('/api/auth/login', { email: 'farmer_e2e@caro.local', password: 'Farmer123!' });
  console.log('  ->', l1.status, l1.body);
  const farmerToken = l1.body?.token;
  const farmerId = l1.body?.user?.id;

  console.log('3) Seed KYC (insert DB entry)');
  const seed = spawnSync('node', ['scripts/seedKyc.js', String(farmerId)], { cwd: process.cwd(), encoding: 'utf8' });
  console.log('  -> stdout:', seed.stdout);
  console.log('  -> stderr:', seed.stderr);

  console.log('4) Login Admin');
  const lAdm = await post('/api/auth/login', { email: 'admin3@caro.local', password: 'Pwd12345!' });
  console.log('  ->', lAdm.status, lAdm.body);
  const adminToken = lAdm.body?.token;

  console.log('5) Get pending KYC (admin)');
  const pkyc = await get('/api/admin/kyc/pending', adminToken);
  console.log('  ->', pkyc.status, pkyc.body);
  const kycId = pkyc.body?.data?.[0]?.id;

  if (kycId) {
    console.log('6) Approve KYC id', kycId);
    const apr = await post(`/api/admin/kyc/${kycId}/review`, { action: 'approve' }, adminToken);
    console.log('  ->', apr.status, apr.body);
  } else console.log('  -> no kyc to approve');

  console.log('7) Farmer create token request');
  const create = await post('/api/token/requests', { kg_amount: 42, lot_id: 'LOT-E2E-42', grade: 'A' }, farmerToken);
  console.log('  ->', create.status, create.body);

  console.log('8) Admin list token requests');
  const treq = await get('/api/token/admin/requests', adminToken);
  console.log('  ->', treq.status, treq.body);
  const reqId = treq.body?.data?.[0]?.id;

  if (reqId) {
    console.log('9) Approve token request', reqId);
    const rev = await post(`/api/token/admin/requests/${reqId}/review`, { action: 'approve' }, adminToken);
    console.log('  ->', rev.status, rev.body);

    console.log('10) Mint token request', reqId);
    const mint = await post(`/api/token/admin/requests/${reqId}/mint`, { tx_hash: '0xE2E_TEST' }, adminToken);
    console.log('  ->', mint.status, mint.body);
  } else console.log('  -> no token requests found');

  console.log('11) Verify token_requests and mint_history for farmer');
  const userReqs = await get('/api/token/requests', farmerToken);
  console.log('  -> farmer requests:', userReqs.status, userReqs.body);

  const trades = await get('/api/market/tickers');
  console.log('12) Market tickers:', trades.status, trades.body);

  const tradesList = await get('/api/market/trades');
  console.log('13) Trades list:', tradesList.status, tradesList.body);

  console.log('E2E finished');
}

run().catch(e=>{console.error(e); process.exit(1);});
