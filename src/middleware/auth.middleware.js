const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // 🚀 FIX: Robust token parsing supporting Bearer tokens across all client browsers
  const authHeader = req.header('Authorization') || req.header('authorization');
  if (!authHeader) return res.status(401).json({ message: 'No token, authorization denied' });

  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  if (!token) return res.status(401).json({ message: 'Malformed authorization token header format' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
    req.user = decoded; // ⚡ Attaches the payload session object context
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid or has expired' });
  }
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Unauthorized dashboard role tier bounds' });
    }
    next();
  };
};

module.exports = { authMiddleware, checkRole };
