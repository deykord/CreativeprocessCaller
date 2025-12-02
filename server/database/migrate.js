#!/usr/bin/env node

/**
 * Database migration script
 * Initializes PostgreSQL database schema
 */

const pool = require('../config/database');
const databaseService = require('../services/databaseService');
const bcrypt = require('bcrypt');

async function migrate() {
  console.log('Starting database migration...');

  try {
    // 1. Initialize schema (skip if already exists)
    console.log('\n1. Checking database schema...');
    try {
      await databaseService.initializeSchema();
      console.log('Database schema initialized successfully');
    } catch (error) {
      if (error.code === '42710' || error.message.includes('already exists')) {
        console.log('Database schema already exists, skipping initialization');
      } else {
        throw error;
      }
    }

    // 2. Create default admin user if not exists
    console.log('\n2. Ensuring default admin user...');
    try {
      const adminEmail = 'admin@creativeprocess.io';
      const existingAdmin = await databaseService.getUserByEmail(adminEmail);
      
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.query(
          `INSERT INTO users (email, password, first_name, last_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO NOTHING`,
          [adminEmail, hashedPassword, 'Admin', 'User', 'admin', true]
        );
        console.log('  ✓ Created default admin user');
        console.log('    Email: admin@creativeprocess.io');
        console.log('    Password: admin123');
      } else {
        console.log('  ✓ Admin user already exists');
      }
    } catch (error) {
      console.error('  ✗ Error creating admin user:', error.message);
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('\nMigration script completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nMigration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrate;
