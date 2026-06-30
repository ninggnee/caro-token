import db from '../config/db.js';

// Detect whether audit_logs has the extended schema (added by migration).
// Result is cached after the first call so we only pay the cost once.
let _extendedSchema = null;
async function hasExtendedSchema() {
  if (_extendedSchema !== null) return _extendedSchema;
  try {
    const [cols] = await db.execute(`SHOW COLUMNS FROM audit_logs`);
    const names  = cols.map(c => c.Field);
    _extendedSchema = names.includes('entity_type');
  } catch (_) {
    _extendedSchema = false;
  }
  return _extendedSchema;
}

export const listLogs = async (req, res) => {
  try {
    const page   = Number(req.query.page)  || 1;
    const limit  = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { action, actor_id, entity_type } = req.query;
    const extended = await hasExtendedSchema();

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
    if (entity_type && extended) {
      whereClause += ' AND a.entity_type = ?';
      params.push(entity_type);
    }

    // Build SELECT list based on actual schema
    const extraCols = extended
      ? `a.entity_type, a.entity_id, a.old_data, a.new_data, a.ip_address, a.user_agent,`
      : `NULL AS entity_type, NULL AS entity_id, NULL AS old_data, NULL AS new_data, NULL AS ip_address, NULL AS user_agent,`;

    const query = `
      SELECT
        a.id,
        a.actor_id,
        u.email     AS actor_email,
        u.full_name AS actor_name,
        a.action,
        ${extraCols}
        a.meta,
        a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ${whereClause}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM audit_logs a
      ${whereClause}
    `;

    const [[{ total }]] = await db.execute(countQuery, params);
    const [rows]        = await db.execute(query, [...params, limit, offset]);

    res.json({ success: true, logs: rows, total, page, limit });
  } catch (err) {
    console.error('listLogs error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
