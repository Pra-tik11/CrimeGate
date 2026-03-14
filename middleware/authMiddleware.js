// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// ── Verify JWT Token ───────────────────────────────
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Admin Only ─────────────────────────────────────
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access only' });
};

// ── Officer Only ───────────────────────────────────
const isOfficer = (req, res, next) => {
  if (req.user && (req.user.role === 'officer' || req.user.role === 'admin')) return next();
  return res.status(403).json({ success: false, message: 'Officer access only' });
};

// ── Citizen Only ───────────────────────────────────
const isCitizen = (req, res, next) => {
  if (req.user && req.user.role === 'citizen') return next();
  return res.status(403).json({ success: false, message: 'Citizen access only' });
};

module.exports = { verifyToken, isAdmin, isOfficer, isCitizen };
