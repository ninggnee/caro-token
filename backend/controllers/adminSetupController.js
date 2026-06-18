import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

export const createAdmin = async (req, res) => {
  try {
    const { email, password, full_name, secret } = req.body;
    if (!email || !password || !full_name) return res.status(400).json({ message: 'email,password,full_name required' });

    const setupSecret = process.env.ADMIN_SETUP_SECRET || null;

    // allow creation if secret matches OR there are no admins yet
    let allow = false;
    if (setupSecret && secret && secret === setupSecret) allow = true;

    const [[{ adminCount }]] = await db.execute(`SELECT COUNT(*) as adminCount FROM users WHERE role = 'admin'`);
    if (adminCount === 0) allow = true;

    if (!allow) return res.status(403).json({ message: 'Not allowed to create admin' });

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await db.execute(`INSERT INTO users (email, password_hash, full_name, role, kyc_status) VALUES (?, ?, ?, 'admin', 'approved')`, [email, password_hash, full_name]);

    const userId = result.insertId;

    const token = jwt.sign({ id: userId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    res.json({ success: true, user: { id: userId, email, full_name, role: 'admin' }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
