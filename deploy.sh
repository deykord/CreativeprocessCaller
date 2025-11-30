#!/bin/bash

# =============================================================================
# CreativeprocessCaller - Multi-Branch Deploy Script
# =============================================================================
# Usage:
#   ./deploy.sh --pr           - Deploy pr branch to salescallagent.my (production)
#   ./deploy.sh --dev          - Deploy dev branch to salescallagent.my/dev
#   ./deploy.sh --both         - Deploy both pr and dev
#   ./deploy.sh --quick        - Quick deploy current branch (skip tests)
#   ./deploy.sh --test-only    - Run tests only
#   ./deploy.sh --watch        - Watch mode (auto-deploy on changes)
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
WEBROOT_DEV="/var/www/salescallagent.my/dev"
API_URL_PR="http://localhost:3001/api"
API_URL_DEV="http://localhost:3002/api"
FRONTEND_URL_PR="https://salescallagent.my"
FRONTEND_URL_DEV="https://salescallagent.my/dev"

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
    
    mkdir -p "$WEBROOT_PR" "$WEBROOT_DEV"
    log_success "Webroots ready"
}

# =============================================================================
# Build Frontend for specific environment
# =============================================================================

build_frontend() {
    local TARGET=$1  # "pr" or "dev"
    
    log_header "Building Frontend ($TARGET)"
    
    cd "$PROJECT_DIR"
    
    if [ "$TARGET" = "dev" ]; then
        log_info "Building with base path /dev/"
        VITE_BASE_PATH="/dev/" npm run build
    else
        log_info "Building with base path /"
        VITE_BASE_PATH="/" npm run build
    fi
    
    if [ $? -eq 0 ]; then
        test_pass "Frontend build ($TARGET)"
        log_success "Build size: $(du -sh dist | cut -f1)"
    else
        test_fail "Frontend build failed ($TARGET)"
        exit 1
    fi
}

# =============================================================================
# Deploy Frontend
# =============================================================================

deploy_frontend() {
    local TARGET=$1  # "pr" or "dev"
    local WEBROOT
    
    if [ "$TARGET" = "dev" ]; then
        WEBROOT="$WEBROOT_DEV"
    else
        WEBROOT="$WEBROOT_PR"
    fi
    
    log_header "Deploying Frontend ($TARGET) -> $WEBROOT"
    
    cd "$PROJECT_DIR"
    
    if [ "$TARGET" = "pr" ]; then
        # For pr, remove everything except /dev folder
        find "$WEBROOT" -mindepth 1 -maxdepth 1 ! -name 'dev' -exec rm -rf {} +
        rsync -a dist/ "$WEBROOT/"
    else
        # For dev, just sync to /dev folder
        rm -rf "$WEBROOT"/*
        rsync -a dist/ "$WEBROOT/"
    fi
    
    if [ $? -eq 0 ]; then
        test_pass "Frontend deployed ($TARGET)"
    else
        test_fail "Failed to deploy ($TARGET)"
    fi
    
    nginx -s reload 2>/dev/null && test_pass "Nginx reloaded" || log_warning "Nginx reload skipped"
}

# =============================================================================
# Restart Backend
# =============================================================================

restart_backend() {
    local TARGET=$1  # "pr" or "dev"
    local SERVICE_NAME PORT
    
    if [ "$TARGET" = "dev" ]; then
        SERVICE_NAME="creativeprocess-backend-dev"
        PORT=3002
    else
        SERVICE_NAME="creativeprocess-backend"
        PORT=3001
    fi
    
    log_header "Restarting Backend ($TARGET) on port $PORT"
    
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
# Deploy PR Branch (Production)
# =============================================================================

deploy_pr() {
    log_header "🚀 DEPLOYING PR BRANCH (PRODUCTION)"
    log_branch "pr -> salescallagent.my"
    
    cd "$PROJECT_DIR"
    
    CURRENT_BRANCH=$(git branch --show-current)
    git stash --include-untracked 2>/dev/null
    
    log_info "Switching to pr branch..."
    git checkout pr
    git pull origin pr 2>/dev/null || true
    
    build_frontend "pr"
    deploy_frontend "pr"
    restart_backend "pr"
    
    log_info "Returning to $CURRENT_BRANCH branch..."
    git checkout "$CURRENT_BRANCH"
    git stash pop 2>/dev/null || true
    
    log_success "PR deployment complete! Visit: $FRONTEND_URL_PR"
}

# =============================================================================
# Deploy Dev Branch
# =============================================================================

deploy_dev() {
    log_header "🔧 DEPLOYING DEV BRANCH (TESTING)"
    log_branch "dev -> salescallagent.my/dev"
    
    cd "$PROJECT_DIR"
    
    CURRENT_BRANCH=$(git branch --show-current)
    
    if [ "$CURRENT_BRANCH" = "dev" ]; then
        log_info "Already on dev branch"
    else
        git stash --include-untracked 2>/dev/null
        log_info "Switching to dev branch..."
        git checkout dev
        git pull origin dev 2>/dev/null || true
    fi
    
    build_frontend "dev"
    deploy_frontend "dev"
    restart_backend "dev"
    
    if [ "$CURRENT_BRANCH" != "dev" ]; then
        log_info "Returning to $CURRENT_BRANCH branch..."
        git checkout "$CURRENT_BRANCH"
        git stash pop 2>/dev/null || true
    fi
    
    log_success "Dev deployment complete! Visit: $FRONTEND_URL_DEV"
}

# =============================================================================
# API Health Tests
# =============================================================================

api_health_tests() {
    local TARGET=$1
    local API_URL
    
    if [ "$TARGET" = "dev" ]; then
        API_URL="$API_URL_DEV"
    else
        API_URL="$API_URL_PR"
    fi
    
    log_header "API Health Tests ($TARGET)"
    
    sleep 2
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/prospects" 2>/dev/null || echo "000")
    [ "$RESPONSE" = "200" ] && test_pass "GET /api/prospects ($TARGET)" || test_fail "GET /api/prospects ($TARGET - HTTP $RESPONSE)"
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/voice/numbers" 2>/dev/null || echo "000")
    [ "$RESPONSE" = "200" ] && test_pass "GET /api/voice/numbers ($TARGET)" || test_fail "GET /api/voice/numbers ($TARGET - HTTP $RESPONSE)"
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
    echo -e "  Production (pr):  ${GREEN}$FRONTEND_URL_PR${NC}"
    echo -e "  Development (dev): ${YELLOW}$FRONTEND_URL_DEV${NC}"
    echo ""
    pm2 status
}

# =============================================================================
# Quick Deploy (Current Branch)
# =============================================================================

quick_deploy() {
    log_header "Quick Deploy (Current Branch)"
    
    CURRENT_BRANCH=$(git branch --show-current)
    
    if [ "$CURRENT_BRANCH" = "pr" ]; then
        build_frontend "pr"
        deploy_frontend "pr"
        restart_backend "pr"
        log_success "Deployed to: $FRONTEND_URL_PR"
    elif [ "$CURRENT_BRANCH" = "dev" ]; then
        build_frontend "dev"
        deploy_frontend "dev"
        restart_backend "dev"
        log_success "Deployed to: $FRONTEND_URL_DEV"
    else
        log_warning "Current branch is '$CURRENT_BRANCH'. Building as dev..."
        build_frontend "dev"
        deploy_frontend "dev"
        restart_backend "dev"
        log_success "Deployed to: $FRONTEND_URL_DEV"
    fi
    
    pm2 status
}

# =============================================================================
# Watch Mode
# =============================================================================

watch_mode() {
    log_header "Watch Mode (Dev Branch)"
    log_info "Watching for changes..."
    log_info "Press Ctrl+C to stop"
    echo ""
    
    command -v chokidar &> /dev/null || npm install -g chokidar-cli
    
    chokidar 'src/**/*' 'components/**/*' 'services/**/*' 'server/**/*.js' 'index.tsx' 'App.tsx' 'types.ts' \
        --initial false \
        -c 'echo "🔄 Changes detected..."; bash /root/CreativeprocessCaller/deploy.sh --dev'
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
    echo "Branch Deployment:"
    echo -e "  ${GREEN}--pr${NC}           Deploy pr branch to salescallagent.my (production)"
    echo -e "  ${YELLOW}--dev${NC}          Deploy dev branch to salescallagent.my/dev (testing)"
    echo -e "  ${MAGENTA}--both${NC}         Deploy both pr and dev branches"
    echo ""
    echo "Quick Options:"
    echo "  --quick, -q    Quick deploy current branch (no tests)"
    echo "  --test-only    Run API/DB tests only"
    echo "  --watch, -w    Watch mode - auto-deploy dev on file changes"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh --dev      # Deploy dev branch for testing"
    echo "  ./deploy.sh --pr       # Deploy pr branch to production"
    echo "  ./deploy.sh --both     # Deploy both environments"
    echo ""
    echo "URLs:"
    echo "  Production:  $FRONTEND_URL_PR"
    echo "  Development: $FRONTEND_URL_DEV"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    cd "$PROJECT_DIR"
    
    case "${1:-}" in
        --pr|-p)
            preflight_checks
            deploy_pr
            api_health_tests "pr"
            print_summary
            ;;
        --dev|-d)
            preflight_checks
            deploy_dev
            api_health_tests "dev"
            print_summary
            ;;
        --both|-b)
            preflight_checks
            deploy_pr
            deploy_dev
            api_health_tests "pr"
            api_health_tests "dev"
            database_tests
            print_summary
            ;;
        --quick|-q)
            preflight_checks
            quick_deploy
            ;;
        --test-only|-t)
            preflight_checks
            api_health_tests "pr"
            api_health_tests "dev"
            database_tests
            print_summary
            ;;
        --watch|-w)
            watch_mode
            ;;
        --help|-h|"")
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
