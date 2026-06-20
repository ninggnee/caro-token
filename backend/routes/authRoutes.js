import express from 'express';
import { register, login, refresh, logout, saveWallet, updateProfile, changePassword, getMe } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register',    register);
router.post('/login',       login);
router.post('/refresh',     refresh);
router.post('/logout',      verifyToken, logout);
router.post('/save-wallet', verifyToken, saveWallet);
router.get ('/me',          verifyToken, getMe);
router.put ('/profile',     verifyToken, updateProfile);
router.put ('/password',    verifyToken, changePassword);

export default router;
