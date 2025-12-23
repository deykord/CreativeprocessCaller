#!/bin/bash
# Database Test Data Cleanup Script
# Run this to find and optionally remove any test data from production

echo "========================================"
echo "Production Database Test Data Scanner"
echo "========================================"
echo ""
echo "⚠️  This script will scan for potential test data."
echo "    Review results carefully before deleting anything!"
echo ""

# Check if database credentials are set
if [ -z "$DB_NAME" ]; then
    DB_NAME="creativeprocess_db"
fi

echo "Scanning database: $DB_NAME"
echo ""

echo "1. Checking for test users..."
psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE email LIKE '%test%' OR email LIKE '%@test.com%' OR email LIKE '%example.com%';" 2>/dev/null | xargs | grep -q "^0$" && echo "   ✅ No test users found" || echo "   ⚠️  Test users detected - run query to inspect"

echo ""
echo "2. Checking for test prospects..."
psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM prospects WHERE company LIKE '%Test%' OR company LIKE '%Fake%' OR company LIKE '%Mock%' OR company LIKE '%Sample%' OR company LIKE '%Demo%' OR company LIKE '%Acme%' OR email LIKE '%@test.com%';" 2>/dev/null | xargs | grep -q "^0$" && echo "   ✅ No test prospects found" || echo "   ⚠️  Test prospects detected - run query to inspect"

echo ""
echo "3. Checking for test lead lists..."
psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM lead_lists WHERE name LIKE '%Test%' OR name LIKE '%Sample%' OR name LIKE '%Demo%';" 2>/dev/null | xargs | grep -q "^0$" && echo "   ✅ No test lead lists found" || echo "   ⚠️  Test lead lists detected - run query to inspect"

echo ""
echo "========================================"
echo "Inspection Queries (if needed):"
echo "========================================"
echo ""
echo "To see test users:"
echo "psql -d $DB_NAME -c \"SELECT id, email, first_name, last_name, role, created_at FROM users WHERE email LIKE '%test%' OR email LIKE '%@test.com%' OR email LIKE '%example.com%' ORDER BY created_at DESC;\""
echo ""
echo "To see test prospects:"
echo "psql -d $DB_NAME -c \"SELECT id, first_name, last_name, company, phone, email FROM prospects WHERE company LIKE '%Test%' OR company LIKE '%Fake%' OR company LIKE '%Mock%' OR email LIKE '%@test.com%' ORDER BY created_at DESC LIMIT 20;\""
echo ""
echo "To see test lead lists:"
echo "psql -d $DB_NAME -c \"SELECT id, name, description, created_at FROM lead_lists WHERE name LIKE '%Test%' OR name LIKE '%Sample%' OR name LIKE '%Demo%' ORDER BY created_at DESC;\""
echo ""
echo "========================================"
echo "⚠️  CAUTION: Only delete data you're sure is test data!"
echo "    Always backup before bulk deletions."
echo "========================================"
