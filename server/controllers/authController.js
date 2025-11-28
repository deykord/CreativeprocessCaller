const authService = require('../services/authService');

exports.signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const { user, token } = await authService.signup(email, password, firstName, lastName);

    res.json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
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
