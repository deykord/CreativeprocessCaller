#!/bin/bash

# Database Setup Script for CreativeProcess Caller
# This script installs PostgreSQL, creates the database, and runs migrations

set -e

echo "🚀 CreativeProcess Caller - Database Setup"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Install PostgreSQL if not already installed
echo ""
echo "📦 Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    apt-get update
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    echo "✅ PostgreSQL installed successfully"
else
    echo "✅ PostgreSQL already installed"
fi

# Get database credentials from .env or use defaults
DB_NAME=${DB_NAME:-creativeprocess_caller}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

echo ""
echo "🗄️  Setting up database..."

# Create database and user
sudo -u postgres psql <<EOF
-- Create database if it doesn't exist
SELECT 'CREATE DATABASE ${DB_NAME}' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

\c ${DB_NAME}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

EOF

if [ $? -eq 0 ]; then
    echo "✅ Database '${DB_NAME}' created successfully"
else
    echo "❌ Failed to create database"
    exit 1
fi

echo ""
echo "📊 Running database migrations..."
cd "$(dirname "$0")/.."
node server/database/migrate.js

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "Database Configuration:"
echo "  - Host: localhost"
echo "  - Port: 5432"
echo "  - Database: ${DB_NAME}"
echo "  - User: ${DB_USER}"
echo ""
echo "ℹ️  Update your .env file with these values if needed:"
echo "  USE_DATABASE=true"
echo "  DB_HOST=localhost"
echo "  DB_PORT=5432"
echo "  DB_NAME=${DB_NAME}"
echo "  DB_USER=${DB_USER}"
echo "  DB_PASSWORD=${DB_PASSWORD}"
echo ""
echo "🚀 You can now restart your server with: pm2 restart all"
