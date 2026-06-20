import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return res.status(401).json({ message: "Invalid token format" });

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Accepts a single role string or multiple role strings
export const requireRole = (...roles) => (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const allowed = roles.flat();
  if (!allowed.includes(user.role)) return res.status(403).json({ message: "Forbidden" });
  next();
};
