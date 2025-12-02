const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dbService = require('./databaseService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

class AuthService {
  /**
   * Create a new user with hashed password
   */
  async createUser(email, firstName, lastName, role = 'agent', password = null) {
    // Generate default password if not provided
    const plainPassword = password || (email.split('@')[0] + '123');
    
    // Hash the password before storing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    
    return dbService.createUser(email, firstName, lastName, role, hashedPassword);
  }

  /**
   * Generate JWT token for a user
   */
  generateToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
  }

  /**
   * Get all users
   */
  async getAllUsers() {
    return dbService.getAllUsers();
  }

  /**
   * Update user by ID
   */
  async updateUser(userId, updates) {
    return dbService.updateUser(userId, updates);
  }

  /**
   * Delete user by ID
   */
  async deleteUser(userId) {
    return dbService.deleteUser(userId);
  }

  /**
   * Login user
   */
  async login(email, password) {
    // Find user by email (get full user with password for verification)
    const user = await dbService.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check password using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    console.log(`User logged in: ${email}`);

    // Generate JWT token
    const token = this.generateToken(user);

    // Return sanitized user (without password)
    const sanitizedUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role || 'agent',
      bio: user.bio,
      profilePicture: user.profile_picture
    };

    return {
      user: sanitizedUser,
      token,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    const user = await dbService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}

const authService = new AuthService();

// Initialize default admin user on startup
dbService.ensureAdminUser().catch(err => {
  console.warn('Could not initialize admin user:', err.message);
});

module.exports = authService;
