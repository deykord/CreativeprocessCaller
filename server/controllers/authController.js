const authService = require('../services/authService');

exports.createUser = async (req, res) => {
  try {
    const { email, firstName, lastName, role } = req.body;

    // Validation
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'Email, first name, and last name are required' });
    }

    // Check if requester is admin
    const userRole = req.user?.role || req.decoded?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can create users' });
    }

    const user = await authService.createUser(email, firstName, lastName, role || 'agent');
    const defaultPassword = email.split('@')[0] + '123';

    res.json({
      success: true,
      user,
      message: `User created successfully. Default password: ${defaultPassword}`,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { user, token } = await authService.login(email, password);

    res.json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ success: false, error: error.message });
  }
};

exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = authService.verifyToken(token);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ success: false, error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware
    const user = await authService.getUser(userId);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(404).json({ success: false, error: error.message });
  }
};
