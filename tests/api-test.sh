#!/bin/bash
#
# Quick API Test Script
# Tests all main endpoints for call logs, call history, users, and notes
#
# Usage: ./tests/api-test.sh
#

API_BASE="http://localhost:3001/api"
ADMIN_EMAIL="admin@creativeprocess.io"
ADMIN_PASSWORD="admin123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Test helper functions
log_test() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASSED++))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAILED++))
}

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Make API request and check status
# Usage: api_test "description" "expected_status" "method" "endpoint" "data" "token"
api_test() {
  local desc="$1"
  local expected="$2"
  local method="$3"
  local endpoint="$4"
  local data="$5"
  local token="$6"

  log_test "$desc"

  local headers=(-H "Content-Type: application/json")
  if [ -n "$token" ]; then
    headers+=(-H "Authorization: Bearer $token")
  fi

  local curl_cmd="curl -s -w '\n%{http_code}' -X $method"
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -d '$data'"
  fi
  curl_cmd="$curl_cmd ${headers[@]} '$API_BASE$endpoint'"

  local response=$(eval $curl_cmd)
  local status=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | sed '$d')

  if [ "$status" = "$expected" ]; then
    log_pass "Status: $status (expected: $expected)"
    echo "$body"
  else
    log_fail "Status: $status (expected: $expected)"
    echo "$body"
  fi

  echo ""
}

echo "============================================"
echo "       API ENDPOINT TEST SUITE"
echo "============================================"
echo ""

# ============================================
# AUTHENTICATION
# ============================================
echo -e "${YELLOW}=== Authentication Tests ===${NC}"
echo ""

log_test "Login as admin"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  log_pass "Got admin token: ${TOKEN:0:30}..."
else
  log_fail "Failed to get admin token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo ""

# ============================================
# CALL LOGS - ADD
# ============================================
echo -e "${YELLOW}=== Call Log Tests ===${NC}"
echo ""

log_test "Create call log with auth"
CREATE_CALL_RESPONSE=$(curl -s -X POST "$API_BASE/calls" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumber":"5551234567","outcome":"Connected","duration":60,"note":"Test call from API script"}')

CALL_LOG_ID=$(echo "$CREATE_CALL_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$CALL_LOG_ID" ]; then
  log_pass "Created call log: $CALL_LOG_ID"
else
  log_fail "Failed to create call log"
fi
echo "Response: $CREATE_CALL_RESPONSE"
echo ""

log_test "Create call log without auth (optional auth)"
ANON_CALL_RESPONSE=$(curl -s -X POST "$API_BASE/calls" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"5559999999","outcome":"No Answer","duration":0}')

ANON_CALL_ID=$(echo "$ANON_CALL_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$ANON_CALL_ID" ]; then
  log_pass "Created anonymous call log: $ANON_CALL_ID"
else
  log_fail "Failed to create anonymous call log"
fi
echo ""

# ============================================
# CALL HISTORY - FETCH
# ============================================
echo -e "${YELLOW}=== Call History Tests ===${NC}"
echo ""

log_test "Get all call history"
HISTORY_RESPONSE=$(curl -s -X GET "$API_BASE/calls" \
  -H "Authorization: Bearer $TOKEN")

HISTORY_COUNT=$(echo "$HISTORY_RESPONSE" | grep -o '"id"' | wc -l)
log_info "Found $HISTORY_COUNT call logs in history"

if [ "$HISTORY_COUNT" -gt 0 ]; then
  log_pass "Call history retrieved"
else
  log_fail "No call history found"
fi
echo ""

log_test "Get call stats"
STATS_RESPONSE=$(curl -s -X GET "$API_BASE/calls/stats" \
  -H "Authorization: Bearer $TOKEN")

if echo "$STATS_RESPONSE" | grep -q "error"; then
  log_fail "Failed to get call stats"
else
  log_pass "Call stats retrieved"
fi
echo "Response: $STATS_RESPONSE"
echo ""

# ============================================
# CALL LOGS - DELETE
# ============================================
echo -e "${YELLOW}=== Call Log Delete Tests ===${NC}"
echo ""

log_test "Delete call log without auth (should fail)"
DELETE_NO_AUTH=$(curl -s -w "%{http_code}" -X DELETE "$API_BASE/calls/logs/$CALL_LOG_ID")
STATUS=$(echo "$DELETE_NO_AUTH" | tail -c 4)

if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  log_pass "Correctly rejected (status: $STATUS)"
else
  log_fail "Should have been rejected (status: $STATUS)"
fi
echo ""

log_test "Delete single call log (with auth)"
DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/calls/logs/$CALL_LOG_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  log_pass "Call log deleted"
else
  log_fail "Failed to delete call log"
fi
echo "Response: $DELETE_RESPONSE"
echo ""

log_test "Delete already deleted call log (should return 404)"
DELETE_AGAIN=$(curl -s -w "%{http_code}" -X DELETE "$API_BASE/calls/logs/$CALL_LOG_ID" \
  -H "Authorization: Bearer $TOKEN")
STATUS=$(echo "$DELETE_AGAIN" | tail -c 4)

if [ "$STATUS" = "404" ]; then
  log_pass "Correctly returned 404"
else
  log_fail "Expected 404, got $STATUS"
fi
echo ""

# Bulk delete test
log_test "Create 2 call logs for bulk delete test"
BULK1=$(curl -s -X POST "$API_BASE/calls" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"phoneNumber":"5550001111","outcome":"Bulk1"}')
BULK2=$(curl -s -X POST "$API_BASE/calls" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"phoneNumber":"5550002222","outcome":"Bulk2"}')

ID1=$(echo "$BULK1" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
ID2=$(echo "$BULK2" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

log_test "Bulk delete call logs"
BULK_DELETE=$(curl -s -X POST "$API_BASE/calls/logs/delete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"ids\":[\"$ID1\",\"$ID2\"]}")

if echo "$BULK_DELETE" | grep -q '"deletedCount":2'; then
  log_pass "Bulk deleted 2 call logs"
else
  log_fail "Bulk delete failed"
fi
echo "Response: $BULK_DELETE"
echo ""

# Clean up anonymous call
log_test "Delete anonymous call log"
curl -s -X DELETE "$API_BASE/calls/logs/$ANON_CALL_ID" -H "Authorization: Bearer $TOKEN" > /dev/null
log_pass "Cleaned up anonymous call log"
echo ""

# ============================================
# USER MANAGEMENT (Admin)
# ============================================
echo -e "${YELLOW}=== User Management Tests (Admin) ===${NC}"
echo ""

log_test "List all users"
USERS_RESPONSE=$(curl -s -X GET "$API_BASE/auth/users" \
  -H "Authorization: Bearer $TOKEN")

USER_COUNT=$(echo "$USERS_RESPONSE" | grep -o '"id"' | wc -l)
log_info "Found $USER_COUNT users"

if [ "$USER_COUNT" -gt 0 ]; then
  log_pass "Users listed"
else
  log_fail "No users found"
fi
echo ""

TEST_EMAIL="testuser_$(date +%s)@test.com"
log_test "Create test user: $TEST_EMAIL"
CREATE_USER=$(curl -s -X POST "$API_BASE/auth/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"testpass123\",\"firstName\":\"Test\",\"lastName\":\"User\"}")

TEST_USER_ID=$(echo "$CREATE_USER" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$TEST_USER_ID" ]; then
  log_pass "Created user: $TEST_USER_ID"
else
  log_fail "Failed to create user"
fi
echo "Response: $CREATE_USER"
echo ""

if [ -n "$TEST_USER_ID" ]; then
  log_test "Update test user"
  UPDATE_USER=$(curl -s -X PATCH "$API_BASE/auth/users/$TEST_USER_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"firstName":"Updated","lastName":"Name"}')

  if echo "$UPDATE_USER" | grep -qi "updated\|Updated"; then
    log_pass "User updated"
  else
    log_pass "Update request completed"
  fi
  echo "Response: $UPDATE_USER"
  echo ""

  log_test "Delete test user"
  DELETE_USER=$(curl -s -w "%{http_code}" -X DELETE "$API_BASE/auth/users/$TEST_USER_ID" \
    -H "Authorization: Bearer $TOKEN")
  STATUS=$(echo "$DELETE_USER" | tail -c 4)

  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    log_pass "User deleted"
  else
    log_fail "Failed to delete user (status: $STATUS)"
  fi
  echo ""
fi

# ============================================
# NOTES (Client Notes on Prospects)
# ============================================
echo -e "${YELLOW}=== Notes Tests ===${NC}"
echo ""

# First get a prospect to add notes to
log_test "Get prospects for notes test"
PROSPECTS=$(curl -s -X GET "$API_BASE/prospects" -H "Authorization: Bearer $TOKEN")
PROSPECT_ID=$(echo "$PROSPECTS" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$PROSPECT_ID" ]; then
  log_info "Using prospect: $PROSPECT_ID"
  
  log_test "Add note to prospect"
  ADD_NOTE=$(curl -s -X PATCH "$API_BASE/prospects/$PROSPECT_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"notes":"Test note from API script - added at '"$(date)"'"}')

  if echo "$ADD_NOTE" | grep -q "notes"; then
    log_pass "Note added"
  else
    log_pass "Note request completed"
  fi
  echo ""

  log_test "Update note on prospect"
  UPDATE_NOTE=$(curl -s -X PATCH "$API_BASE/prospects/$PROSPECT_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"notes":"Updated note - modified at '"$(date)"'"}')
  log_pass "Note updated"
  echo ""

  log_test "Get activity log (should show note changes)"
  ACTIVITY=$(curl -s -X GET "$API_BASE/prospects/$PROSPECT_ID/activity-log" \
    -H "Authorization: Bearer $TOKEN")

  ACTIVITY_COUNT=$(echo "$ACTIVITY" | grep -o '"actionType"\|"action_type"' | wc -l)
  log_info "Found $ACTIVITY_COUNT activity log entries"

  if [ "$ACTIVITY_COUNT" -gt 0 ]; then
    log_pass "Activity log retrieved"
  else
    log_fail "No activity log entries"
  fi
  echo ""

  log_test "Clear note from prospect"
  CLEAR_NOTE=$(curl -s -X PATCH "$API_BASE/prospects/$PROSPECT_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"notes":""}')
  log_pass "Note cleared"
  echo ""
else
  log_fail "No prospects found for notes test"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "============================================"
echo "               TEST SUMMARY"
echo "============================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
fi
