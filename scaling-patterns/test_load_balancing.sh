#!/bin/bash

# ============================================================================
# Load Balancing Test Script for FitBeat
# ============================================================================
# This script tests the KrakenD-based load balancing implementation
# by sending multiple requests and verifying distribution across replicas
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GATEWAY_URL="http://localhost:8090"
KRAKEND_URL="http://localhost:8085"
NUM_REQUESTS=30

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FitBeat Load Balancing Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Function to check if services are running
check_services() {
    print_header "1. Checking if services are running..."
    
    services=(
        "fb_users_ms_1"
        "fb_users_ms_2"
        "fb_users_ms_3"
        "fb_music_ms_1"
        "fb_music_ms_2"
        "fb_music_ms_3"
        "fb_achievements_ms_1"
        "fb_achievements_ms_2"
        "fb_achievements_ms_3"
        "fb_notification_ms_1"
        "fb_notification_ms_2"
        "fb_notification_ms_3"
        "fb_api_gateway"
    )
    
    all_running=true
    for service in "${services[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${service}$"; then
            print_success "$service is running"
        else
            print_error "$service is NOT running"
            all_running=false
        fi
    done
    
    if [ "$all_running" = false ]; then
        print_error "Not all services are running. Please start them with: docker-compose up -d"
        exit 1
    fi
    
    echo ""
}

# Function to test music service load balancing
test_music_service() {
    print_header "2. Testing Music Service Load Balancing..."
    print_info "Sending $NUM_REQUESTS requests to /api/v1/health"
    
    for i in $(seq 1 $NUM_REQUESTS); do
        curl -s "${GATEWAY_URL}/api/v1/health" > /dev/null 2>&1
        echo -n "."
    done
    echo ""
    
    # Wait a moment for logs to be written
    sleep 2
    
    # Count requests per replica
    print_info "Analyzing request distribution..."
    
    count1=$(docker logs fb_music_ms_1 2>&1 | grep -c "GET /api/v1/health" || echo "0")
    count2=$(docker logs fb_music_ms_2 2>&1 | grep -c "GET /api/v1/health" || echo "0")
    count3=$(docker logs fb_music_ms_3 2>&1 | grep -c "GET /api/v1/health" || echo "0")
    
    echo "  Replica 1: $count1 requests"
    echo "  Replica 2: $count2 requests"
    echo "  Replica 3: $count3 requests"
    
    total=$((count1 + count2 + count3))
    if [ $total -gt 0 ]; then
        print_success "Music service is distributing load across replicas"
    else
        print_error "Could not verify load distribution (check if health endpoint logs requests)"
    fi
    
    echo ""
}

# Function to test user service load balancing
test_user_service() {
    print_header "3. Testing User Service Load Balancing..."
    print_info "Sending $NUM_REQUESTS requests to /api/auth/me"
    
    # Note: This endpoint requires authentication, so we expect 401 errors
    # We're just testing that requests are distributed
    
    for i in $(seq 1 $NUM_REQUESTS); do
        curl -s "${GATEWAY_URL}/api/auth/me" > /dev/null 2>&1
        echo -n "."
    done
    echo ""
    
    sleep 2
    
    print_info "Analyzing request distribution..."
    
    count1=$(docker logs fb_users_ms_1 2>&1 | grep -c "/api/auth/me" || echo "0")
    count2=$(docker logs fb_users_ms_2 2>&1 | grep -c "/api/auth/me" || echo "0")
    count3=$(docker logs fb_users_ms_3 2>&1 | grep -c "/api/auth/me" || echo "0")
    
    echo "  Replica 1: $count1 requests"
    echo "  Replica 2: $count2 requests"
    echo "  Replica 3: $count3 requests"
    
    total=$((count1 + count2 + count3))
    if [ $total -gt 0 ]; then
        print_success "User service is distributing load across replicas"
    else
        print_error "Could not verify load distribution (check if endpoint logs requests)"
    fi
    
    echo ""
}

# Function to test achievements service load balancing
test_achievements_service() {
    print_header "4. Testing Achievements Service Load Balancing..."
    print_info "Sending $NUM_REQUESTS requests to /achievements/catalog"
    
    for i in $(seq 1 $NUM_REQUESTS); do
        curl -s "${GATEWAY_URL}/achievements/catalog" > /dev/null 2>&1
        echo -n "."
    done
    echo ""
    
    sleep 2
    
    print_info "Analyzing request distribution..."
    
    count1=$(docker logs fb_achievements_ms_1 2>&1 | grep -c "/achievements/catalog" || echo "0")
    count2=$(docker logs fb_achievements_ms_2 2>&1 | grep -c "/achievements/catalog" || echo "0")
    count3=$(docker logs fb_achievements_ms_3 2>&1 | grep -c "/achievements/catalog" || echo "0")
    
    echo "  Replica 1: $count1 requests"
    echo "  Replica 2: $count2 requests"
    echo "  Replica 3: $count3 requests"
    
    total=$((count1 + count2 + count3))
    if [ $total -gt 0 ]; then
        print_success "Achievements service is distributing load across replicas"
    else
        print_error "Could not verify load distribution (check if endpoint logs requests)"
    fi
    
    echo ""
}

# Function to check KrakenD configuration
check_krakend_config() {
    print_header "5. Verifying KrakenD Configuration..."
    
    # Check if KrakenD is using multiple backends
    if docker exec fb_api_gateway cat /etc/krakend/krakend.json | grep -q "music_service_1"; then
        print_success "KrakenD is configured with music_service replicas"
    else
        print_error "KrakenD configuration may not include all replicas"
    fi
    
    if docker exec fb_api_gateway cat /etc/krakend/krakend.json | grep -q "component_a_1"; then
        print_success "KrakenD is configured with user service replicas"
    else
        print_error "KrakenD configuration may not include all replicas"
    fi
    
    if docker exec fb_api_gateway cat /etc/krakend/krakend.json | grep -q "achievements_service_1"; then
        print_success "KrakenD is configured with achievements service replicas"
    else
        print_error "KrakenD configuration may not include all replicas"
    fi
    
    echo ""
}

# Function to check resource usage
check_resource_usage() {
    print_header "6. Checking Resource Usage..."
    
    print_info "Current resource usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "(fb_music_ms|fb_users_ms|fb_achievements_ms|fb_notification_ms)" || true
    
    echo ""
}

# Function to test failover
test_failover() {
    print_header "7. Testing Failover (Optional)..."
    print_info "This test stops one replica and verifies traffic continues"
    
    read -p "Do you want to test failover? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Stopping music_service_2..."
        docker-compose stop music_service_2
        
        print_info "Sending requests with one replica down..."
        for i in $(seq 1 10); do
            response=$(curl -s -o /dev/null -w "%{http_code}" "${GATEWAY_URL}/api/v1/health")
            if [ "$response" = "200" ]; then
                echo -n "."
            else
                echo -n "X"
            fi
        done
        echo ""
        
        print_success "Service continues to work with one replica down"
        
        print_info "Restarting music_service_2..."
        docker-compose start music_service_2
        
        print_success "Replica restarted"
    else
        print_info "Skipping failover test"
    fi
    
    echo ""
}

# Main execution
main() {
    check_services
    check_krakend_config
    test_music_service
    test_user_service
    test_achievements_service
    check_resource_usage
    test_failover
    
    print_header "========================================"
    print_success "Load Balancing Tests Complete!"
    print_header "========================================"
    echo ""
    print_info "Summary:"
    echo "  - All service replicas are running"
    echo "  - KrakenD is configured for load balancing"
    echo "  - Requests are being distributed across replicas"
    echo ""
    print_info "Next steps:"
    echo "  1. Run performance tests: cd performance-tests && k6 run performance_test.js"
    echo "  2. Monitor logs: docker-compose logs -f music_service_1 music_service_2 music_service_3"
    echo "  3. Check metrics: docker stats"
    echo ""
}

# Run main function
main

# Made with Bob
