const authService = require('../services/authService');
const dbService = require('../services/databaseService');

exports.createUser = async (req, res) => {
  try {
    const { email, firstName, lastName, role, password } = req.body;

    // Validation
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'Email, first name, and last name are required' });
    }

    // Check if requester is admin
    const userRole = req.user?.role || req.decoded?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can create users' });
    }

    const user = await authService.createUser(email, firstName, lastName, role || 'agent', password);
    const defaultPassword = password ? '(custom password)' : (email.split('@')[0] + '123');

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

    const decoded = authService.verifyToken(token);
    const user = await authService.getUser(decoded.userId);
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

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId; // Set by auth middleware
    const { firstName, lastName, email, bio, profilePicture, workHours } = req.body;

    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email) updates.email = email;
    if (bio !== undefined) updates.bio = bio;
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;
    if (workHours) updates.workHours = JSON.stringify(workHours);

    const user = await dbService.updateUser(userId, updates);

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getTeamMembers = async (req, res) => {
  try {
    const teamMembers = await dbService.getAllUsers();
    res.json(teamMembers);
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await authService.createUser(
      email,
      firstName || email.split('@')[0],
      lastName || 'User',
      role || 'agent',
      password
    );

    const token = authService.generateToken(user);

    res.status(201).json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const userRole = req.user?.role || req.decoded?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await authService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get user by ID (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const userRole = req.user?.role || req.decoded?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const user = await authService.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(404).json({ error: error.message });
  }
};

// Update user (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const userRole = req.user?.role || req.decoded?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const user = await authService.updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(400).json({ error: error.message });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const userRole = req.user?.role || req.decoded?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const success = await authService.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(400).json({ error: error.message });
  }
};
