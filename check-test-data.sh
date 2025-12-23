#!/bin/bash
# Quick script to check for test data in production

echo "==================================="
echo "Test Data Audit - Production Check"
echo "==================================="
echo ""

echo "1. Checking for seed file..."
if [ -f "server/database/seed.sql" ]; then
    echo "   ⚠️  WARNING: seed.sql file exists and could be run!"
else
    echo "   ✅ seed.sql is disabled/removed"
fi

echo ""
echo "2. Checking for test data patterns in code..."
TEST_PATTERNS=$(grep -r "@test\.com\|@example\.com\|Acme Corporation" server/ --exclude-dir=node_modules 2>/dev/null | grep -v ".DISABLED" | wc -l)
if [ "$TEST_PATTERNS" -gt 0 ]; then
    echo "   ⚠️  Found $TEST_PATTERNS potential test patterns"
    grep -r "@test\.com\|@example\.com\|Acme Corporation" server/ --exclude-dir=node_modules 2>/dev/null | grep -v ".DISABLED"
else
    echo "   ✅ No test data patterns found in server code"
fi

echo ""
echo "3. Schema.sql data insertions..."
SCHEMA_INSERTS=$(grep "INSERT INTO" server/database/schema.sql | wc -l)
echo "   Found $SCHEMA_INSERTS INSERT statements:"
grep "INSERT INTO" server/database/schema.sql | grep -v "^[[:space:]]*--"

echo ""
echo "==================================="
echo "Audit Complete"
echo "==================================="
