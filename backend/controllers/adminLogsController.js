import db from '../config/db.js';

export const listLogs = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { action, actor_id, entity_type } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (action) {
      whereClause += ' AND a.action LIKE ?';
      params.push(`%${action}%`);
    }
    if (actor_id) {
      whereClause += ' AND a.actor_id = ?';
      params.push(Number(actor_id));
    }
    if (entity_type) {
      whereClause += ' AND a.entity_type = ?';
      params.push(entity_type);
    }

    const query = `
      SELECT 
        a.id,
        a.actor_id,
        u.email as actor_email,
        u.full_name as actor_name,
        a.action,
        a.entity_type,
        a.entity_id,
        a.old_data,
        a.new_data,
        a.ip_address,
        a.user_agent,
        a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ${whereClause}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs a
      ${whereClause}
    `;

    const [[{ total }]] = await db.execute(countQuery, params);
    const [rows] = await db.execute(query, [...params, limit, offset]);

    res.json({
      success: true,
      logs: rows,
      total,
      page,
      limit
    });
  } catch (err) {
    console.error('listLogs error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
