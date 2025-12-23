# No Test Data Policy

**Last Updated:** December 23, 2025  
**Status:** ✅ ENFORCED

## Policy Statement

This application **DOES NOT** and **WILL NOT** create fake, test, mock, or sample data in the production database. All data must be real and created by actual users through the application interface.

---

## Audit Results

### ✅ Clean Areas

1. **Database Schema** (`server/database/schema.sql`)
   - Only creates tables and functions
   - Only inserts ONE default admin user: `admin@creativeprocess.io`
   - No test prospects, no test call logs, no fake data

2. **Database Initialization** (`server/services/databaseService.js`)
   - Only runs `schema.sql` to create tables
   - Does NOT run seed files automatically
   - No automatic data population

3. **Application Code** (`server/**/*.js`)
   - No hardcoded test data
   - No automatic data seeding on startup
   - All data comes from user input via API

4. **Test Files** (All properly configured)
   - Tests create temporary data with unique timestamps
   - All test files have CLEANUP sections that delete test data
   - Tests track created resources and delete them after completion
   - No production database pollution

### 🔒 Disabled/Secured Files

1. **Seed File** - `server/database/seed.sql.DISABLED`
   - Original name: `seed.sql`
   - **DISABLED** (renamed to `.DISABLED`)
   - Contains 20 fake prospects (Acme Corporation, TechStart Inc, etc.)
   - **NOT** executed automatically
   - **NOT** referenced in any application code
   - Kept for reference only - do not use in production

2. **Mock Twilio Service** - `services/mockTwilio.ts`
   - Frontend-only simulation for UI development
   - Does NOT touch the database
   - Does NOT create any records
   - Safe to keep

---

## Test Data Management

### Test Files Configuration

All test files properly clean up after themselves:

1. **`tests/team-management.test.ts`**
   - Creates users with `@test.com` emails + timestamp
   - Tracks all created user IDs
   - Cleanup section deletes all test users

2. **`tests/api.test.ts`**
   - Tracks created: call logs, prospects, users
   - Cleanup section deletes all test data
   - Uses unique timestamps to avoid conflicts

3. **`tests/data-insertion.test.ts`**
   - Creates test prospects and lists
   - Full cleanup after tests complete
   - No residual data

### How Tests Work

```typescript
// Tests create unique data:
const timestamp = Date.now();
const email = `testuser_${timestamp}@test.com`;

// Tests track what they create:
const createdUserIds = [];
createdUserIds.push(newUserId);

// Tests clean up:
describe('Cleanup', () => {
  it('should delete all test data', async () => {
    for (const id of createdUserIds) {
      await apiRequest(`/auth/users/${id}`, 'DELETE');
    }
  });
});
```

### Running Tests Safely

Tests should be run against a **test database**, not production:

```bash
# Set test API URL before running tests
export API_URL=http://localhost:3001/api  # Test server
npm run test
```

**Never run tests against production database!**

---

## Data Sources

### Only Real Data Allowed

All production data comes from:

1. **Admin Dashboard** - Manual user creation
2. **Signup/Login** - User self-registration
3. **Lead Upload** - CSV imports of real prospects
4. **API Calls** - Real phone calls logged
5. **Manual Dialer** - Agent-initiated calls

### What's NOT Created

❌ No test users  
❌ No fake prospects  
❌ No mock call logs  
❌ No sample companies  
❌ No dummy data of any kind

---

## Developer Guidelines

### When Adding New Features

1. ✅ **DO** allow users to create their own data through UI/API
2. ✅ **DO** write tests with proper cleanup
3. ✅ **DO** use unique timestamps in test data
4. ❌ **DON'T** create seed files
5. ❌ **DON'T** insert hardcoded test data
6. ❌ **DON'T** run tests against production

### When Writing Tests

```typescript
// ✅ GOOD - Creates unique, trackable, cleanable test data
const timestamp = Date.now();
const testUser = {
  email: `testuser_${timestamp}@test.com`,
  // ... other fields
};
const userId = await createUser(testUser);
testDataIds.push(userId); // Track for cleanup

afterAll(async () => {
  // Clean up all test data
  for (const id of testDataIds) {
    await deleteUser(id);
  }
});
```

```typescript
// ❌ BAD - Creates hardcoded data that might persist
const testUser = {
  email: 'test@test.com', // Not unique!
  // ... other fields
};
await createUser(testUser); // No cleanup!
```

---

## Maintenance Checklist

Run this checklist periodically to ensure no test data creeps in:

```bash
# 1. Check for seed file usage
grep -r "seed.sql" server/ --exclude-dir=node_modules

# 2. Check for test data in codebase
grep -r "@test.com\|@example.com" server/ --exclude-dir=node_modules

# 3. Check database for test data patterns
psql -d creativeprocess_db -c "SELECT * FROM users WHERE email LIKE '%test%' OR email LIKE '%@test.com%';"
psql -d creativeprocess_db -c "SELECT * FROM prospects WHERE company LIKE '%Test%' OR company LIKE '%Fake%';"

# 4. Verify schema.sql only has admin user
grep "INSERT INTO" server/database/schema.sql

# 5. Check that seed file is disabled
ls -la server/database/seed.sql* 
# Should show: seed.sql.DISABLED
```

---

## Emergency Cleanup

If test data accidentally gets into production:

```sql
-- Find test users
SELECT * FROM users WHERE email LIKE '%test%' OR email LIKE '%@test.com%';

-- Find test prospects (check for common test companies)
SELECT * FROM prospects WHERE 
  company LIKE '%Test%' OR 
  company LIKE '%Fake%' OR
  company LIKE '%Mock%' OR
  company LIKE '%Sample%' OR
  company LIKE '%Demo%' OR
  company LIKE '%Acme%';

-- Delete carefully after verification
-- DELETE FROM users WHERE email LIKE '%@test.com%';
-- DELETE FROM prospects WHERE company = 'Test Company';
```

**Always backup before mass deletions!**

---

## Compliance

This policy ensures:

- ✅ Clean production database
- ✅ Accurate analytics and reporting
- ✅ No confusion between test and real data
- ✅ Professional appearance in production
- ✅ GDPR compliance (no fake personal data)
- ✅ Accurate billing and usage metrics

---

## Questions?

If you need to populate data for:

- **Development**: Use the disabled seed file locally only
- **Testing**: Tests auto-create and cleanup their own data
- **Production**: Users create data through the application
- **Demos**: Create a separate demo environment

**Contact:** System Administrator  
**Policy Version:** 1.0
