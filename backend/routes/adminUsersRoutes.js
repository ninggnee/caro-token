import express from "express";

import {
  listUsers,
  deleteUser,
  getUserDetail,
  updateUser,
} from "../controllers/adminUsersController.js";

import {
  verifyToken,
  requireRole,
} from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /admin/users
 */
router.get(
  "/",
  verifyToken,
  requireRole("admin"),
  listUsers
);

/**
 * GET /admin/users/:id
 */
router.get(
  "/:id",
  verifyToken,
  requireRole("admin"),
  getUserDetail
);

/**
 * PUT /admin/users/:id
 */
router.put(
  "/:id",
  verifyToken,
  requireRole("admin"),
  updateUser
);

/**
 * DELETE /admin/users/:id
 */
router.delete(
  "/:id",
  verifyToken,
  requireRole("admin"),
  deleteUser
);

export default router;