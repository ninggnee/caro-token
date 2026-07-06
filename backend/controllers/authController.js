/**
 * authController — authentication + refresh token (Part 6).
 *
 * Token strategy:
 *   access_token:  15 minutes  (JWT, stateless)
 *   refresh_token: 30 days     (stored in sessions table, rotated on every use)
 *
 * Rotation: each call to /refresh issues a new refresh token and
 * invalidates the old one (is_revoked = 1).
 * This prevents reuse after logout or token theft.
 */

import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import crypto from 'crypto';
import db     from '../config/db.js';
import { logAction, auditMeta } from '../services/AuditService.js';
import { uploadToIPFS } from '../services/IpfsService.js';

const ACCESS_EXPIRES  = '8h';
const REFRESH_DAYS    = 30;

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function storeRefreshToken(userId, refreshToken, req) {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  try {
    await db.execute(
      `INSERT INTO sessions (user_id, refresh_token, expires_at, is_revoked, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, 0, ?, ?, NOW())`,
      [userId, refreshToken, expiresAt, req?.ip || null, req?.headers?.['user-agent'] || null]
    );
  } catch {
    // Fallback: sessions table may not have extra columns (migration not yet run)
    await db.execute(
      `INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)`,
      [userId, refreshToken, expiresAt]
    );
  }
}

async function getKycDetailsForUser(userId) {
  let id_number = null;
  let front_path = null;
  let back_path = null;
  try {
    const [kycRows] = await db.execute(
      `SELECT id_number, front_path, back_path FROM kyc_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (kycRows.length > 0) {
      id_number = kycRows[0].id_number;
      front_path = kycRows[0].front_path;
      back_path = kycRows[0].back_path;
      return { id_number, front_path, back_path };
    }
  } catch (_) {
    try {
      const [kycRows] = await db.execute(
        `SELECT id_number, document_front AS front_path, document_back AS back_path FROM kyc_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
        [userId]
      );
      if (kycRows.length > 0) {
        id_number = kycRows[0].id_number;
        front_path = kycRows[0].front_path;
        back_path = kycRows[0].back_path;
        return { id_number, front_path, back_path };
      }
    } catch (_) {}
  }
  return { id_number, front_path, back_path };
}

// ── Register ──────────────────────────────────────────────────────────────────

export const register = async (req, res) => {
  try {
    const { email, password, full_name, phone, role } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: 'email, password, and full_name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có tối thiểu 6 ký tự' });
    }

    const [existing] = await db.execute(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      `INSERT INTO users (email, password_hash, full_name, phone, role, kyc_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [email, password_hash, full_name, phone || null, role || 'trader']
    );

    const insertId = result.insertId;

    const token = jwt.sign(
      {
        id: insertId,
        role: role || 'trader',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      success: true,
      message: "Register success",
      token,
      user: {
        id: insertId,
        email,
        full_name,
        phone: phone || null,
        role: role || 'trader',
        kyc_status: "pending",
        id_number: null,
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error?.message || 'Server error' });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log(`Login attempt email=${email} ip=${req.ip}`);

    const [users] = await db.execute(`SELECT * FROM users WHERE email = ?`, [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    const user = users[0];

    if (role && user.role !== role) {
      return res.status(403).json({ message: 'Role mismatch' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Wrong password' });
    }

    const accessToken  = signAccess({ id: user.id, role: user.role });
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken, req);

    // Fetch wallet address
    let wallet_address = user.wallet_address || null;
    try {
      const [rows] = await db.execute(
        `SELECT wallet_address FROM user_wallets WHERE user_id = ? AND role = ? LIMIT 1`,
        [user.id, user.role]
      );
      if (rows.length > 0 && rows[0].wallet_address) wallet_address = rows[0].wallet_address;
    } catch (_) { /* ignore */ }

    // Fetch latest KYC request details (CCCD and image paths)
    const kycDetails = await getKycDetailsForUser(user.id);
    const id_number = kycDetails.id_number;
    const front_path = kycDetails.front_path;
    const back_path = kycDetails.back_path;

    await logAction({
      actorId: user.id, action: 'auth:login',
      entityType: 'user', entityId: user.id,
      ...auditMeta(req),
    });

    res.json({
      success: true,
      access_token:  accessToken,
      token:         accessToken,          // backward compat
      refresh_token: refreshToken,
      user: {
        id:            user.id,
        email:         user.email,
        full_name:     user.full_name,
        phone:         user.phone    || null,
        address:       user.address  || null,
        role:          user.role,
        wallet_address,
        kyc_status:    user.kyc_status,
        id_number,
        front_path,
        back_path,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Refresh ───────────────────────────────────────────────────────────────────

export const refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ message: 'refresh_token required' });

    const [[session]] = await db.execute(
      `SELECT * FROM sessions WHERE refresh_token = ? LIMIT 1`,
      [refresh_token]
    );
    if (!session) return res.status(401).json({ message: 'Invalid refresh token' });
    if (session.is_revoked === 1) return res.status(401).json({ message: 'Revoked refresh token' });

    if (new Date(session.expires_at) < new Date()) {
      try { await db.execute(`UPDATE sessions SET is_revoked = 1 WHERE id = ?`, [session.id]); } catch (_) {}
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    const [[user]] = await db.execute(`SELECT id, role FROM users WHERE id = ? LIMIT 1`, [session.user_id]);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Rotate: revoke old, issue new
    try { await db.execute(`UPDATE sessions SET is_revoked = 1 WHERE id = ?`, [session.id]); } catch (_) {}

    const newAccessToken  = signAccess({ id: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, newRefreshToken, req);

    res.json({
      success:       true,
      access_token:  newAccessToken,
      token:         newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

export const logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await db.execute(
        `UPDATE sessions SET is_revoked = 1 WHERE refresh_token = ?`,
        [refresh_token]
      );
    }
    await logAction({
      actorId: req.user?.id || null, action: 'auth:logout',
      entityType: 'user', entityId: req.user?.id || null,
      ...auditMeta(req),
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get current user (me) ──────────────────────────────────────────────────────

export const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [[user]] = await db.execute(
      `SELECT id, email, full_name, phone, address, role, kyc_status, wallet_address,
              farm_coords, farm_code, farm_area, farm_location, farm_soil_type, certifications
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Fetch wallet address from user_wallets if not set in users
    let wallet_address = user.wallet_address || null;
    try {
      const [rows] = await db.execute(
        `SELECT wallet_address FROM user_wallets WHERE user_id = ? AND role = ? LIMIT 1`,
        [userId, user.role]
      );
      if (rows.length > 0 && rows[0].wallet_address) wallet_address = rows[0].wallet_address;
    } catch (_) {}

    // Fetch latest KYC request details (CCCD and image paths)
    const kycDetails = await getKycDetailsForUser(userId);
    const id_number = kycDetails.id_number;
    const front_path = kycDetails.front_path;
    const back_path = kycDetails.back_path;

    res.json({
      success: true,
      user: {
        ...user,
        wallet_address,
        id_number,
        front_path,
        back_path,
      }
    });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Update profile ────────────────────────────────────────────────────────────

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      full_name, phone, address,
      farm_coords, farm_code, farm_area, farm_location, farm_soil_type, certifications
    } = req.body;
    if (!full_name?.trim()) {
      return res.status(400).json({ message: 'full_name is required' });
    }

    if (farm_area !== undefined && farm_area !== null && farm_area !== '') {
      const areaStr = String(farm_area).trim();
      if (!/^\d{1,2}(\.\d{1,2})?$/.test(areaStr) || Number(areaStr) < 1 || Number(areaStr) > 10) {
        return res.status(400).json({ message: 'Diện tích (farm_area) phải trong khoảng 1 - 10 ha, tối đa 2 chữ số thập phân' });
      }
    }

    await db.execute(
      `UPDATE users SET
         full_name = ?, phone = ?, address = ?,
         farm_coords = ?, farm_code = ?, farm_area = ?, farm_location = ?, farm_soil_type = ?, certifications = ?
       WHERE id = ?`,
      [
        full_name.trim(), phone?.trim() || null, address?.trim() || null,
        farm_coords || null, farm_code || null, farm_area ? Number(farm_area) : null,
        farm_location || null, farm_soil_type || null, certifications || null,
        userId
      ]
    );

    const [[user]] = await db.execute(
      `SELECT id, email, full_name, phone, address, role, kyc_status, wallet_address,
              farm_coords, farm_code, farm_area, farm_location, farm_soil_type, certifications
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    // Fetch latest KYC request details (CCCD and image paths)
    const kycDetails = await getKycDetailsForUser(userId);
    const id_number = kycDetails.id_number;
    const front_path = kycDetails.front_path;
    const back_path = kycDetails.back_path;

    await logAction({
      actorId: userId, action: 'user:update_profile',
      entityType: 'user', entityId: userId,
      newData: { full_name, phone, address }, ...auditMeta(req),
    });

    res.json({ success: true, user: { ...user, id_number, front_path, back_path } });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Change password ───────────────────────────────────────────────────────────

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'current_password and new_password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'new_password must be at least 6 characters' });
    }

    const [[user]] = await db.execute(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });

    const newHash = await bcrypt.hash(new_password, 10);
    await db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, userId]);

    await logAction({
      actorId: userId, action: 'user:change_password',
      entityType: 'user', entityId: userId, ...auditMeta(req),
    });

    res.json({ success: true, message: 'Mật khẩu đã được cập nhật' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Save wallet ───────────────────────────────────────────────────────────────

export const saveWallet = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { wallet_address } = req.body;
    const role = req.user.role || req.body.role || '';
    const addr = wallet_address ? wallet_address.trim() : null;

    await db.execute(
      `INSERT INTO user_wallets (user_id, role, wallet_address)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE wallet_address = VALUES(wallet_address)`,
      [userId, role, addr]
    );
    await db.execute(`UPDATE users SET wallet_address = ? WHERE id = ?`, [addr, userId]);

    res.json({ success: true, wallet_address: addr, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const uploadCertDoc = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'Không có file nào được chọn' });
    }

    let cid = null;
    try {
      cid = await uploadToIPFS(file.buffer, file.originalname, file.mimetype);
    } catch (ipfsErr) {
      console.warn(`IPFS upload skipped for cert: ${ipfsErr.message}`);
    }

    res.json({
      success: true,
      file_name: file.originalname,
      ipfs_cid: cid
    });
  } catch (err) {
    console.error('uploadCertDoc error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
