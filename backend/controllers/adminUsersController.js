import db from "../config/db.js";

/**
 * GET /admin/users
 * Query:
 *  ?role=admin|farmer|trader
 */
export const listUsers = async (req, res) => {
  try {
    const role = req.query.role;

    const allowedRoles = [
      "admin",
      "farmer",
      "trader",
    ];

    const roleParam = allowedRoles.includes(role)
      ? role
      : "";

    const query = `
      SELECT
        u.id,
        u.email,
        u.role,
        u.full_name,
        u.kyc_status,
        u.is_active,
        u.phone,
        u.address,

        (
          SELECT wallet_address
          FROM user_wallets uw
          WHERE uw.user_id = u.id
          LIMIT 1
        ) AS wallet_address

      FROM users u

      WHERE (? = '' OR u.role = ?)

      ORDER BY u.id DESC

      LIMIT 200
    `;

    const [rows] = await db.execute(
      query,
      [roleParam, roleParam]
    );

    res.json({
      success: true,
      users: rows,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * DELETE /admin/users/:id
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [exist] = await db.execute(
      `
      SELECT id, role
      FROM users
      WHERE id = ?
      `,
      [id]
    );

    if (!exist.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (exist[0].role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa tài khoản admin",
      });
    }

    await db.execute(
      `
      DELETE FROM user_wallets
      WHERE user_id = ?
      `,
      [id]
    );

    await db.execute(
      `
      DELETE FROM users
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * GET /admin/users/:id
 */
export const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(
      `
      SELECT
        id,
        email,
        role,
        full_name,
        kyc_status,
        wallet_address,
        is_active,
        phone,
        address
      FROM users
      WHERE id = ?
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: rows[0],
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * PUT /admin/users/:id
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      full_name,
      email,
      phone,
      address,
      role,
      kyc_status,
      is_active,
    } = req.body;

    const allowedRoles = [
      "admin",
      "farmer",
      "trader",
    ];

    const allowedKyc = [
      "pending",
      "approved",
      "rejected",
    ];

    const [exist] = await db.execute(
      `SELECT role, kyc_status, is_active, full_name, email, phone, address FROM users WHERE id = ?`,
      [id]
    );

    if (!exist.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentUser = exist[0];

    if (
      role &&
      !allowedRoles.includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    if (
      kyc_status &&
      !allowedKyc.includes(kyc_status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid KYC status",
      });
    }

    if (email && email !== currentUser.email) {
      const [existing] = await db.execute(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [email, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Email already exists for another account",
        });
      }
    }

    try {
      await db.execute(
        `
        UPDATE users
        SET
          full_name = ?,
          email = ?,
          phone = ?,
          address = ?,
          role = ?,
          kyc_status = ?,
          is_active = ?
        WHERE id = ?
        `,
        [
          full_name !== undefined ? full_name : currentUser.full_name,
          email !== undefined ? email : currentUser.email,
          phone !== undefined ? phone : currentUser.phone,
          address !== undefined ? address : currentUser.address,
          role !== undefined ? role : currentUser.role,
          kyc_status !== undefined ? kyc_status : currentUser.kyc_status,
          is_active !== undefined ? Number(is_active) : currentUser.is_active,
          id,
        ]
      );
    } catch (err) {
      // Fallback if phone or address columns don't exist
      await db.execute(
        `
        UPDATE users
        SET
          full_name = ?,
          email = ?,
          role = ?,
          kyc_status = ?,
          is_active = ?
        WHERE id = ?
        `,
        [
          full_name !== undefined ? full_name : currentUser.full_name,
          email !== undefined ? email : currentUser.email,
          role !== undefined ? role : currentUser.role,
          kyc_status !== undefined ? kyc_status : currentUser.kyc_status,
          is_active !== undefined ? Number(is_active) : currentUser.is_active,
          id,
        ]
      );
    }

    res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * GET /admin/users/abnormal
 * Lấy danh sách các tài khoản có hành vi rút token bất thường
 */
export const getAbnormalActivities = async (req, res) => {
  try {
    const query = `
      SELECT 
        aa.id,
        aa.user_id,
        aa.activity_type,
        aa.description,
        aa.created_at,
        u.email,
        u.role,
        u.full_name
      FROM abnormal_activities aa
      JOIN users u ON aa.user_id = u.id
      ORDER BY aa.id DESC
      LIMIT 100
    `;
    const [rows] = await db.execute(query);
    res.json({
      success: true,
      activities: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};