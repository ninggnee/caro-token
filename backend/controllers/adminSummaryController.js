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

    // Fetch v2 asset batches metrics
    let pendingBatches = 0;
    let mintedBatches = 0;
    let rejectedBatches = 0;
    let totalBatchKg = 0;

    try {
      const [[pb]] = await db.execute(`SELECT COUNT(*) as pb FROM asset_batches WHERE status='PENDING_MINT_APPROVAL'`);
      const [[mb]] = await db.execute(`SELECT COUNT(*) as mb FROM asset_batches WHERE status='MINTED'`);
      const [[rb]] = await db.execute(`SELECT COUNT(*) as rb FROM asset_batches WHERE status='REJECTED'`);
      const [[tk]] = await db.execute(`SELECT COALESCE(SUM(quantity),0) as tk FROM asset_batches WHERE status='MINTED'`);

      pendingBatches = pb.pb;
      mintedBatches = mb.mb;
      rejectedBatches = rb.rb;
      totalBatchKg = tk.tk;
    } catch (batchErr) {
      console.warn("asset_batches table count error, using 0 fallback:", batchErr.message);
    }

    // ── Token state breakdown ──────────────────────────────────────────────
    // Available / locked come directly from user_balances aggregate.
    // Specific lock reasons are derived from the domain tables.
    let tokenAvailable = 0, tokenLocked = 0, tokenCirculating = 0;
    let tokenPledged = 0, tokenLcLocked = 0, tokenDiscounted = 0, tokenBurned = 0;

    try {
      const [[bals]] = await db.execute(
        `SELECT COALESCE(SUM(available_balance),0) AS avail,
                COALESCE(SUM(locked_balance),   0) AS locked,
                COALESCE(SUM(balance),          0) AS total
         FROM user_balances`
      );
      tokenAvailable   = Number(bals.avail);
      tokenLocked      = Number(bals.locked);
      tokenCirculating = Number(bals.total);
    } catch {}

    try {
      const [[r]] = await db.execute(
        `SELECT COALESCE(SUM(quantity),0) AS v FROM collateral_loans
         WHERE status IN ('approved','disbursed','active')`
      );
      tokenPledged = Number(r.v);
    } catch {}

    try {
      const [[r]] = await db.execute(
        `SELECT COALESCE(SUM(token_amount),0) AS v FROM redeem_requests
         WHERE status = 'pending'`
      );
      tokenLcLocked = Number(r.v);
    } catch {}

    try {
      const [[r]] = await db.execute(
        `SELECT COALESCE(SUM(quantity),0) AS v FROM token_discounting
         WHERE status IN ('approved','payment_pending','completed')`
      );
      tokenDiscounted = Number(r.v);
    } catch {}

    try {
      const [[r]] = await db.execute(
        `SELECT COALESCE(SUM(token_amount),0) AS v FROM redeem_requests
         WHERE status = 'approved'`
      );
      tokenBurned = Number(r.v);
    } catch {}

    res.json({
      success: true,
      summary: {
        totalFarmers,
        totalTraders,
        totalKyc,
        pendingKyc,
        rejectedKyc,
        pendingTokenRequests,
        totalTokens,
        totalKg,
        totalVolumeVnd,
        supplementRequests,
        redeemProcessing,
        pendingBatches,
        mintedBatches,
        rejectedBatches,
        totalBatchKg,
        // token state breakdown
        tokenCirculating,
        tokenAvailable,
        tokenLocked,
        tokenPledged,
        tokenLcLocked,
        tokenDiscounted,
        tokenBurned,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

