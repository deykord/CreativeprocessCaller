#!/usr/bin/env node

/**
 * Database migration script
 * Initializes PostgreSQL database and migrates existing in-memory data
 */

const pool = require('../config/database');
const databaseService = require('../services/databaseService');
const mockDatabase = require('../services/mockDatabase');
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

    // 2. Migrate users
    console.log('\n2. Migrating users...');
    const users = mockDatabase.users;
    const userIdMap = {}; // Old ID -> New UUID mapping

    for (const user of users) {
      try {
        // Hash password if not already hashed
        const hashedPassword = user.password.startsWith('$2b$') 
          ? user.password 
          : await bcrypt.hash(user.password, 10);

        const result = await pool.query(
          `INSERT INTO users (email, password, first_name, last_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE 
           SET first_name = $3, last_name = $4, role = $5
           RETURNING id`,
          [user.email, hashedPassword, user.firstName, user.lastName, user.role, user.isActive]
        );
        userIdMap[user.id] = result.rows[0].id;
        console.log(`  ✓ Migrated user: ${user.email}`);
      } catch (error) {
        console.error(`  ✗ Error migrating user ${user.email}:`, error.message);
      }
    }

    // 3. Migrate prospects
    console.log('\n3. Migrating prospects...');
    const prospects = await mockDatabase.getAllProspects();
    const prospectIdMap = {}; // Old ID -> New UUID mapping

    for (const prospect of prospects) {
      try {
        const result = await pool.query(
          `INSERT INTO prospects 
           (first_name, last_name, company, title, phone, email, status, timezone, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (phone) DO UPDATE
           SET first_name = $1, last_name = $2, company = $3, title = $4, 
               email = $6, status = $7, timezone = $8, notes = $9
           RETURNING id`,
          [
            prospect.firstName,
            prospect.lastName,
            prospect.company,
            prospect.title,
            prospect.phone,
            prospect.email,
            prospect.status,
            prospect.timezone,
            prospect.notes
          ]
        );
        prospectIdMap[prospect.id] = result.rows[0].id;
        console.log(`  ✓ Migrated prospect: ${prospect.firstName} ${prospect.lastName}`);
      } catch (error) {
        console.error(`  ✗ Error migrating prospect ${prospect.firstName}:`, error.message);
      }
    }

    // 4. Migrate call logs
    console.log('\n4. Migrating call logs...');
    const callLogs = mockDatabase.callHistory || [];

    for (const log of callLogs) {
      try {
        const prospectUuid = prospectIdMap[log.prospectId];
        const callerUuid = userIdMap['user_1']; // Default to first user

        if (!prospectUuid) {
          console.log(`  ⚠ Skipping call log - prospect not found: ${log.prospectId}`);
          continue;
        }

        await pool.query(
          `INSERT INTO call_logs 
           (prospect_id, caller_id, phone_number, from_number, outcome, duration, notes, started_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            prospectUuid,
            callerUuid,
            log.phoneNumber,
            log.fromNumber,
            log.outcome,
            log.duration,
            log.note,
            log.timestamp
          ]
        );
        console.log(`  ✓ Migrated call log for: ${log.prospectName}`);
      } catch (error) {
        console.error(`  ✗ Error migrating call log:`, error.message);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nMigration Summary:');
    console.log(`  - Users migrated: ${Object.keys(userIdMap).length}`);
    console.log(`  - Prospects migrated: ${Object.keys(prospectIdMap).length}`);
    console.log(`  - Call logs migrated: ${callLogs.length}`);

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
