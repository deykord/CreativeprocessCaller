const authService = require('../services/authService');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        // Allow unauthenticated call log creation from external systems
        // (POST /api/calls) - handled as optional auth elsewhere, but some middleware
        // paths may still call this middleware; be permissive here to avoid 401s.
        if (req.method === 'POST' && req.path && req.path.startsWith('/calls')) {
          console.log('Auth middleware allowing unauthenticated POST to /calls');
          return next();
        }
        return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = authService.verifyToken(token);
    req.userId = decoded.userId;
    // Provide both formats for compatibility
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: ' + error.message });
  }
};

module.exports = authMiddleware;
