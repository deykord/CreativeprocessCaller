const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { users } = require('./mockDatabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

class AuthService {
  /**
   * Create a new user (admin only)
   */
  async createUser(email, firstName, lastName, role = 'agent') {
    // Check if user already exists
    const existingUser = Array.from(users.values()).find(u => u.email === email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create new user with auto-generated password
    const userId = uuidv4();
    const password = email.split('@')[0] + '123'; // Default password: part_of_email+123
    const user = {
      id: userId,
      email,
      firstName,
      lastName,
      password,
      role: role || 'agent',
      createdAt: new Date().toISOString(),
    };

    users.set(userId, user);
    console.log(`User created by admin: ${email} (password: ${password})`);

    return this._sanitizeUser(user);
  }

  /**
   * Login user
   */
  async login(email, password) {
    // Find user by email
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check password (in production, use bcrypt.compare)
    if (user.password !== password) {
      throw new Error('Invalid email or password');
    }

    console.log(`User logged in: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return {
      user: this._sanitizeUser(user),
      token,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = users.get(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }
      return this._sanitizeUser(user);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    const user = users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return this._sanitizeUser(user);
  }

  /**
   * Remove sensitive data from user object
   */
  _sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return { ...sanitized, role: user.role || 'agent' };
  }
}

const authService = new AuthService();

// Initialize with default admin user if none exists
const adminEmail = 'admin@creativeprocess.io';
const adminUser = Array.from(users.values()).find(u => u.email === adminEmail);
if (!adminUser) {
  const adminId = uuidv4();
  const adminPassword = 'admin123';
  users.set(adminId, {
    id: adminId,
    email: adminEmail,
    firstName: 'Admin',
    lastName: 'User',
    password: adminPassword,
    role: 'admin',
    createdAt: new Date().toISOString(),
  });
  console.log('Default admin user created:');
  console.log('  Email:', adminEmail);
  console.log('  Password:', adminPassword);
}

module.exports = authService;
