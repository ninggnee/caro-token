import db from "../config/db.js";

export const listPending = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT k.id, k.user_id, k.id_number, COALESCE(k.front_path, k.document_front, '') AS front_path, COALESCE(k.back_path, k.document_back, '') AS back_path, k.status, k.created_at, u.email, u.full_name FROM kyc_requests k JOIN users u ON k.user_id = u.id WHERE k.status = 'pending' ORDER BY k.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const reviewKyc = async (req, res) => {
  try {
    const id = req.params.id;
    const { action } = req.body; // 'approve' or 'reject'
    const adminId = req.user?.id;

    if (!['approve','reject'].includes(action)) return res.status(400).json({ message: 'Invalid action' });

    const status = action === 'approve' ? 'approved' : 'rejected';

    // update status and timestamp - adapt to schema (no reviewed_by column guaranteed)
    await db.execute(`UPDATE kyc_requests SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);

    const [[row]] = await db.execute(`SELECT user_id FROM kyc_requests WHERE id = ?`, [id]);
    if (row) {
      await db.execute(`UPDATE users SET kyc_status = ? WHERE id = ?`, [status, row.user_id]);
    }

    res.json({ success: true, message: `KYC ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
