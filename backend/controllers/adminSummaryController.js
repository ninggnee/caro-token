import db from '../config/db.js';

export const getSummary = async (req, res) => {
  try {
    const [[{ totalFarmers }]] = await db.execute(`SELECT COUNT(*) as totalFarmers FROM users WHERE role='farmer'`);
    const [[{ totalTraders }]] = await db.execute(`SELECT COUNT(*) as totalTraders FROM users WHERE role='trader'`);
    const [[{ pendingKyc }]] = await db.execute(`SELECT COUNT(*) as pendingKyc FROM kyc_requests WHERE status='pending'`);
    const [[{ rejectedKyc }]] = await db.execute(`SELECT COUNT(*) as rejectedKyc FROM kyc_requests WHERE status='rejected'`);
    const [[{ totalKyc }]] = await db.execute(`SELECT COUNT(*) as totalKyc FROM kyc_requests`);

    const [[{ pendingTokenRequests }]] = await db.execute(`SELECT COUNT(*) as pendingTokenRequests FROM token_requests WHERE status='pending'`);
    const [[{ totalTokens }]] = await db.execute(`SELECT COALESCE(SUM(minted_amount),0) as totalTokens FROM mint_history`);
    const [[{ totalKg }]] = await db.execute(`SELECT COALESCE(SUM(kg_amount),0) as totalKg FROM token_requests WHERE status='approved' OR status='minted'`);

    const [[{ totalVolumeVnd }]] = await db.execute(`SELECT COALESCE(SUM(price * amount),0) as totalVolumeVnd FROM trades`);

    const [[{ supplementRequests }]] = await db.execute(`SELECT 0 as supplementRequests`); // placeholder

    const [[{ redeemProcessing }]] = await db.execute(`SELECT COUNT(*) as redeemProcessing FROM redeem_requests WHERE status='pending'`);

    res.json({ success: true, summary: { totalFarmers, totalTraders, totalKyc, pendingKyc, rejectedKyc, pendingTokenRequests, totalTokens, totalKg, totalVolumeVnd, supplementRequests, redeemProcessing } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
