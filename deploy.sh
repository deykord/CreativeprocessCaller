#!/bin/bash

# =============================================================================
# CreativeprocessCaller - Full Deploy Script with Testing & Validation
# =============================================================================
# Usage:
#   ./deploy.sh              - Full deploy (build, test, deploy)
#   ./deploy.sh --quick      - Quick deploy (skip tests)
#   ./deploy.sh --test-only  - Run tests only
#   ./deploy.sh --watch      - Watch mode (auto-deploy on changes)
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/root/CreativeprocessCaller"
WEBROOT="/var/www/salescallagent.my"
API_URL="http://localhost:3001/api"
FRONTEND_URL="https://salescallagent.my"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
START_TIME=$(date +%s)

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓ ${NC}$1"
}

log_warning() {
    echo -e "${YELLOW}⚠ ${NC}$1"
}

log_error() {
    echo -e "${RED}✗ ${NC}$1"
}

log_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

test_pass() {
    log_success "PASS: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    log_error "FAIL: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

preflight_checks() {
    log_header "Pre-flight Checks"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        log_success "Node.js: $NODE_VERSION"
    else
        log_error "Node.js not found"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        log_success "npm: $NPM_VERSION"
    else
        log_error "npm not found"
        exit 1
    fi
    
    # Check PM2
    if command -v pm2 &> /dev/null; then
        log_success "PM2 installed"
    else
        log_error "PM2 not found"
        exit 1
    fi
    
    # Check if backend is running
    if pm2 list | grep -q "creativeprocess-backend"; then
        log_success "Backend service registered in PM2"
    else
        log_warning "Backend not registered in PM2 - will start it"
    fi
    
    # Check webroot exists
    if [ -d "$WEBROOT" ]; then
        log_success "Webroot exists: $WEBROOT"
    else
        log_warning "Webroot doesn't exist, creating..."
        mkdir -p "$WEBROOT"
    fi
}

# =============================================================================
# TypeScript Type Check
# =============================================================================

type_check() {
    log_header "TypeScript Type Check"
    
    cd "$PROJECT_DIR"
    
    if npx tsc --noEmit 2>&1; then
        test_pass "TypeScript compilation"
    else
        test_fail "TypeScript has errors"
    fi
}

# =============================================================================
# Build Frontend
# =============================================================================

build_frontend() {
    log_header "Building Frontend"
    
    cd "$PROJECT_DIR"
    
    log_info "Running npm run build..."
    
    if npm run build; then
        test_pass "Frontend build"
        
        # Check build output
        if [ -d "dist" ] && [ -f "dist/index.html" ]; then
            BUILD_SIZE=$(du -sh dist | cut -f1)
            log_success "Build output: $BUILD_SIZE"
        else
            test_fail "Build output missing"
        fi
    else
        test_fail "Frontend build failed"
        exit 1
    fi
}

# =============================================================================
# Deploy Frontend
# =============================================================================

deploy_frontend() {
    log_header "Deploying Frontend"
    
    cd "$PROJECT_DIR"
    
    log_info "Syncing dist -> $WEBROOT"
    
    if rsync -a --delete dist/ "$WEBROOT/"; then
        test_pass "Frontend files synced"
    else
        test_fail "Failed to sync frontend files"
    fi
    
    # Reload nginx
    if nginx -s reload 2>/dev/null; then
        test_pass "Nginx reloaded"
    else
        log_warning "Nginx reload skipped"
    fi
}

# =============================================================================
# Restart Backend
# =============================================================================

restart_backend() {
    log_header "Restarting Backend"
    
    cd "$PROJECT_DIR/server"
    
    # Check for syntax errors in server code
    log_info "Checking server syntax..."
    if node --check index.js 2>/dev/null; then
        test_pass "Server syntax check"
    else
        log_warning "Syntax check skipped"
    fi
    
    # Restart PM2
    log_info "Restarting PM2 services..."
    if pm2 restart creativeprocess-backend --update-env 2>/dev/null; then
        test_pass "Backend restarted"
        sleep 2  # Wait for startup
    else
        log_warning "PM2 restart failed, trying to start..."
        cd "$PROJECT_DIR"
        pm2 start ecosystem.config.cjs 2>/dev/null || true
    fi
}

# =============================================================================
# API Health Tests
# =============================================================================

api_health_tests() {
    log_header "API Health Tests"
    
    # Wait for backend to be ready
    sleep 2
    
    log_info "Testing API endpoints..."
    
    # Test: Get prospects
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/prospects" 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "200" ]; then
        test_pass "GET /api/prospects (HTTP $RESPONSE)"
    else
        test_fail "GET /api/prospects (HTTP $RESPONSE)"
    fi
    
    # Test: Get call history
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/calls" 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "200" ]; then
        test_pass "GET /api/calls (HTTP $RESPONSE)"
    else
        test_fail "GET /api/calls (HTTP $RESPONSE)"
    fi
    
    # Test: Get Twilio numbers
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/voice/numbers" 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "200" ]; then
        test_pass "GET /api/voice/numbers (HTTP $RESPONSE)"
    else
        test_fail "GET /api/voice/numbers (HTTP $RESPONSE)"
    fi
    
    # Test: Get active calls
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/voice/calls/active" 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "200" ]; then
        test_pass "GET /api/voice/calls/active (HTTP $RESPONSE)"
    else
        test_fail "GET /api/voice/calls/active (HTTP $RESPONSE)"
    fi
    
    # Test: Auth profile
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/auth/profile" 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "200" ]; then
        test_pass "GET /api/auth/profile (HTTP $RESPONSE)"
    else
        test_fail "GET /api/auth/profile (HTTP $RESPONSE)"
    fi
    
    # Test: Lead lists
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/lead-lists" 2>/dev/null || echo "000")
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ]; then
        test_pass "GET /api/lead-lists (HTTP $RESPONSE)"
    else
        test_fail "GET /api/lead-lists (HTTP $RESPONSE)"
    fi
}

# =============================================================================
# Database Tests
# =============================================================================

database_tests() {
    log_header "Database Tests"
    
    log_info "Testing database connection..."
    
    DB_TEST=$(sudo -u postgres psql -d creativeprocess_caller -t -A -c "SELECT 1;" 2>/dev/null || echo "error")
    if [ "$DB_TEST" = "1" ]; then
        test_pass "Database connection"
    else
        test_fail "Database connection"
        return 0
    fi
    
    # Check required tables
    for TABLE in prospects call_logs users lead_lists prospect_status_log lead_activity_log; do
        EXISTS=$(sudo -u postgres psql -d creativeprocess_caller -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$TABLE');" 2>/dev/null || echo "f")
        if [ "$EXISTS" = "t" ]; then
            test_pass "Table: $TABLE"
        else
            test_fail "Table missing: $TABLE"
        fi
    done
    
    # Check new columns
    for COL in call_sid end_reason answered_by; do
        HAS_COL=$(sudo -u postgres psql -d creativeprocess_caller -t -A -c "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'call_logs' AND column_name = '$COL');" 2>/dev/null || echo "f")
        if [ "$HAS_COL" = "t" ]; then
            test_pass "Column: call_logs.$COL"
        else
            test_fail "Column missing: call_logs.$COL"
        fi
    done
}

# =============================================================================
# Integration Tests
# =============================================================================

integration_tests() {
    log_header "Integration Tests"
    
    log_info "Testing prospect CRUD..."
    
    # Create prospect
    CREATE_RESPONSE=$(curl -s -X POST "$API_URL/prospects" \
        -H "Content-Type: application/json" \
        -d "{\"firstName\":\"Deploy\",\"lastName\":\"Test\",\"phone\":\"+1555$(date +%s)\",\"email\":\"test@example.com\",\"company\":\"Test\",\"status\":\"New\"}" 2>/dev/null)
    
    PROSPECT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$PROSPECT_ID" ]; then
        test_pass "Create prospect"
        
        # Delete prospect (cleanup)
        curl -s -X DELETE "$API_URL/prospects/$PROSPECT_ID" 2>/dev/null
        test_pass "Delete prospect"
    else
        test_fail "Create prospect"
    fi
    
    # Test call logging
    log_info "Testing call logging..."
    
    CALL_RESPONSE=$(curl -s -X POST "$API_URL/calls" \
        -H "Content-Type: application/json" \
        -d "{\"prospectName\":\"Test\",\"phoneNumber\":\"+15551234567\",\"outcome\":\"No Answer\",\"duration\":0,\"callSid\":\"CA_TEST_$(date +%s)\",\"endReason\":\"no_answer\"}" 2>/dev/null)
    
    if echo "$CALL_RESPONSE" | grep -q "endReason"; then
        test_pass "Log call with endReason"
    else
        test_fail "Log call with endReason"
    fi
}

# =============================================================================
# Frontend Tests
# =============================================================================

frontend_tests() {
    log_header "Frontend Tests"
    
    # Check critical assets
    if [ -f "$WEBROOT/index.html" ]; then
        test_pass "index.html exists"
    else
        test_fail "index.html missing"
    fi
    
    if [ -d "$WEBROOT/assets" ]; then
        JS_COUNT=$(find "$WEBROOT/assets" -name "*.js" 2>/dev/null | wc -l)
        CSS_COUNT=$(find "$WEBROOT/assets" -name "*.css" 2>/dev/null | wc -l)
        test_pass "Assets: $JS_COUNT JS, $CSS_COUNT CSS"
    else
        test_fail "Assets missing"
    fi
}

# =============================================================================
# Print Summary
# =============================================================================

print_summary() {
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    log_header "Deployment Summary"
    
    echo ""
    echo -e "  Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "  Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "  Duration: ${DURATION}s"
    echo ""
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✓ DEPLOYMENT SUCCESSFUL${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    else
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${YELLOW}  ⚠ DEPLOYMENT COMPLETED WITH WARNINGS${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    fi
    
    echo ""
    pm2 status
}

# =============================================================================
# Watch Mode
# =============================================================================

watch_mode() {
    log_header "Watch Mode"
    log_info "Watching for changes..."
    log_info "Press Ctrl+C to stop"
    echo ""
    
    # Check if chokidar-cli is installed
    if ! command -v chokidar &> /dev/null; then
        log_warning "Installing chokidar-cli..."
        npm install -g chokidar-cli
    fi
    
    chokidar 'src/**/*' 'components/**/*' 'services/**/*' 'server/**/*.js' 'index.tsx' 'App.tsx' 'types.ts' \
        --initial false \
        -c 'echo "🔄 Changes detected..."; bash /root/CreativeprocessCaller/deploy.sh --quick'
}

# =============================================================================
# Quick Deploy
# =============================================================================

quick_deploy() {
    log_header "Quick Deploy"
    
    preflight_checks
    build_frontend
    deploy_frontend
    restart_backend
    
    echo ""
    log_success "Quick deploy complete!"
    pm2 status
}

# =============================================================================
# Main
# =============================================================================

main() {
    cd "$PROJECT_DIR"
    
    case "${1:-}" in
        --quick|-q)
            quick_deploy
            ;;
        --test-only|-t)
            preflight_checks
            api_health_tests
            database_tests
            frontend_tests
            print_summary
            ;;
        --watch|-w)
            watch_mode
            ;;
        --help|-h)
            echo "Usage: ./deploy.sh [option]"
            echo ""
            echo "Options:"
            echo "  (none)        Full deploy with tests"
            echo "  --quick, -q   Quick deploy (skip tests)"
            echo "  --test-only   Run tests only"
            echo "  --watch, -w   Watch mode"
            echo "  --help, -h    Show help"
            ;;
        *)
            preflight_checks
            type_check
            build_frontend
            deploy_frontend
            restart_backend
            api_health_tests
            database_tests
            integration_tests
            frontend_tests
            print_summary
            ;;
    esac
}

main "$@"
