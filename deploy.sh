#!/bin/bash

# =============================================================================
# CreativeprocessCaller - Deployment Script
# =============================================================================
# Usage:
#   ./deploy.sh                - Deploy pr branch to salescallagent.my (production)
#   ./deploy.sh --quick        - Quick deploy current branch (skip tests)
#   ./deploy.sh --test-only    - Run tests only
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/root/CreativeprocessCaller"
WEBROOT_PR="/var/www/salescallagent.my"
API_URL_PR="http://localhost:3001/api"
FRONTEND_URL_PR="https://salescallagent.my"

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

log_branch() {
    echo -e "${MAGENTA}🔀 Branch: $1${NC}"
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
    
    if command -v node &> /dev/null; then
        log_success "Node.js: $(node -v)"
    else
        log_error "Node.js not found"
        exit 1
    fi
    
    if command -v pm2 &> /dev/null; then
        log_success "PM2 installed"
    else
        log_error "PM2 not found"
        exit 1
    fi
    
    if command -v git &> /dev/null; then
        log_success "Git branch: $(git branch --show-current)"
    else
        log_error "Git not found"
        exit 1
    fi
    
    mkdir -p "$WEBROOT_PR"
    log_success "Webroots ready"
}

# =============================================================================
# Run Unit Tests (Vitest)
# =============================================================================

run_unit_tests() {
    log_header "Running Unit Tests"
    
    cd "$PROJECT_DIR"
    
    log_info "Executing vitest test suite..."
    
    # Run vitest tests
    npm test 2>&1 | tee /tmp/test_output.txt
    TEST_EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        # Extract test counts from output
        PASSED=$(grep -oP '✓.*\(\d+ tests?\)' /tmp/test_output.txt | wc -l)
        test_pass "Unit tests passed ($PASSED test files)"
        return 0
    else
        test_fail "Unit tests failed"
        log_error "Test output:"
        tail -20 /tmp/test_output.txt
        return 1
    fi
}

# =============================================================================
# Build Frontend for production
# =============================================================================

build_frontend() {
    log_header "Building Frontend"
    
    cd "$PROJECT_DIR"
    
    log_info "Building with base path /"
    VITE_BASE_PATH="/" npm run build
    
    if [ $? -eq 0 ]; then
        test_pass "Frontend build"
        log_success "Build size: $(du -sh dist | cut -f1)"
    else
        test_fail "Frontend build failed"
        exit 1
    fi
}

# =============================================================================
# Deploy Frontend
# =============================================================================

deploy_frontend() {
    log_header "Deploying Frontend -> $WEBROOT_PR"
    
    cd "$PROJECT_DIR"
    
    # Clear old files completely
    rm -rf "$WEBROOT_PR"/*
    
    # Deploy new build
    rsync -a dist/ "$WEBROOT_PR/"
    
    if [ $? -eq 0 ]; then
        test_pass "Frontend deployed"
    else
        test_fail "Failed to deploy"
    fi
    
    # Clear nginx cache and reload
    log_info "Clearing nginx cache..."
    rm -rf /var/cache/nginx/* 2>/dev/null
    
    # Reload nginx with cache clear
    nginx -s reload 2>/dev/null && test_pass "Nginx reloaded + cache cleared" || log_warning "Nginx reload skipped"
    
    log_info "✓ All old assets removed, new build deployed with cache busting"
}

# =============================================================================
# Restart Backend
# =============================================================================

restart_backend() {
    local SERVICE_NAME="creativeprocess-backend"
    local PORT=3001
    
    log_header "Restarting Backend on port $PORT"
    
    cd "$PROJECT_DIR/server"
    
    if pm2 list | grep -q "$SERVICE_NAME"; then
        pm2 restart "$SERVICE_NAME" --update-env 2>/dev/null && test_pass "Backend restarted ($SERVICE_NAME)" || {
            log_warning "Restart failed, trying start..."
            PORT=$PORT pm2 start server.js --name "$SERVICE_NAME"
        }
    else
        log_info "Starting new service: $SERVICE_NAME"
        PORT=$PORT pm2 start server.js --name "$SERVICE_NAME"
        test_pass "Backend started ($SERVICE_NAME)"
    fi
    
    sleep 2
}

# =============================================================================
# Deploy Production
# =============================================================================

deploy_production() {
    log_header "🚀 DEPLOYING PRODUCTION"
    log_branch "pr -> salescallagent.my"
    
    cd "$PROJECT_DIR"
    
    CURRENT_BRANCH=$(git branch --show-current)
    git stash --include-untracked 2>/dev/null
    
    log_info "Switching to pr branch..."
    git checkout pr
    git pull origin pr 2>/dev/null || true
    
    # Run tests before build
    if ! run_unit_tests; then
        log_error "Tests failed! Aborting deployment."
        git checkout "$CURRENT_BRANCH"
        git stash pop 2>/dev/null || true
        exit 1
    fi
    
    build_frontend
    deploy_frontend
    restart_backend
    
    log_info "Returning to $CURRENT_BRANCH branch..."
    git checkout "$CURRENT_BRANCH"
    git stash pop 2>/dev/null || true
    
    log_success "Deployment complete! Visit: $FRONTEND_URL_PR"
}

# =============================================================================
# API Health Tests
# =============================================================================

api_health_tests() {
    log_header "API Health Tests"
    
    sleep 2
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL_PR/prospects" 2>/dev/null || echo "000")
    [ "$RESPONSE" = "200" ] && test_pass "GET /api/prospects" || test_fail "GET /api/prospects (HTTP $RESPONSE)"
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL_PR/voice/numbers" 2>/dev/null || echo "000")
    [ "$RESPONSE" = "200" ] && test_pass "GET /api/voice/numbers" || test_fail "GET /api/voice/numbers (HTTP $RESPONSE)"
}

# =============================================================================
# Database Tests
# =============================================================================

database_tests() {
    log_header "Database Tests"
    
    DB_TEST=$(sudo -u postgres psql -d creativeprocess_caller -t -A -c "SELECT 1;" 2>/dev/null || echo "error")
    [ "$DB_TEST" = "1" ] && test_pass "Database connection" || test_fail "Database connection"
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
    echo -e "${CYAN}URLs:${NC}"
    echo -e "  Production:  ${GREEN}$FRONTEND_URL_PR${NC}"
    echo ""
    pm2 status
}

# =============================================================================
# Quick Deploy (Current Branch - skip tests)
# =============================================================================

quick_deploy() {
    log_header "Quick Deploy (Current Branch - NO TESTS)"
    log_warning "Skipping unit tests for quick deploy"
    
    CURRENT_BRANCH=$(git branch --show-current)
    
    log_info "Building current branch: $CURRENT_BRANCH"
    build_frontend
    deploy_frontend
    restart_backend
    log_success "Deployed to: $FRONTEND_URL_PR"
    
    pm2 status
}

# =============================================================================
# Help
# =============================================================================

show_help() {
    echo ""
    echo -e "${CYAN}CreativeprocessCaller Deploy Script${NC}"
    echo ""
    echo "Usage: ./deploy.sh [option]"
    echo ""
    echo "Deployment Options:"
    echo -e "  ${GREEN}(no args)${NC}      Deploy pr branch to salescallagent.my (runs tests)"
    echo -e "  ${GREEN}--quick, -q${NC}    Quick deploy current branch (skips tests)"
    echo -e "  ${BLUE}--test-only${NC}    Run API/DB tests only"
    echo ""
    echo "Test Flow:"
    echo "  1. Run unit tests (vitest)"
    echo "  2. Build frontend"
    echo "  3. Copy to webroot"
    echo "  4. Restart PM2 backend"
    echo "  5. Run API health checks"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh            # Full deploy with tests"
    echo "  ./deploy.sh --quick    # Skip tests, quick deploy"
    echo ""
    echo "URL:"
    echo "  Production: $FRONTEND_URL_PR"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    cd "$PROJECT_DIR"
    
    case "${1:-}" in
        --quick|-q)
            preflight_checks
            quick_deploy
            ;;
        --test-only|-t)
            preflight_checks
            api_health_tests
            database_tests
            print_summary
            ;;
        --help|-h)
            show_help
            ;;
        "")
            # Default: full production deployment
            preflight_checks
            deploy_production
            api_health_tests
            print_summary
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
