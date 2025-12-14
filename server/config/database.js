const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'creativeprocess_caller',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  // Connection pool limits to prevent CPU overload
  max: 10, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  statement_timeout: 30000, // Abort any statement that takes more than 30 seconds
  query_timeout: 30000, // Timeout for queries
});

// Test connection
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  // Don't exit process, just log the error
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Database pool has ended');
  process.exit(0);
});

module.exports = pool;
