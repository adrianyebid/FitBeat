/**
 * FitBeat — Performance Test (k6)
 * Endpoint: POST /api/auth/login
 * Path:     Client → Traefik (8090) → KrakenD (8085) → user-service (8000) → PostgreSQL
 *
 * Usage:
 *   k6 run performance_test.js                         # Case 1 — baseline (1 VU)
 *   k6 run -e SCENARIO=case2 performance_test.js       # Case 2 — load (50 VUs)
 *   k6 run -e SCENARIO=case3 performance_test.js       # Case 3 — stress (staged)
 *   k6 run -e BASE_URL=http://my-host:8090 performance_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ──────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8090';
const SCENARIO = __ENV.SCENARIO || 'case1';

const TEST_EMAIL = `perf_user_${Date.now()}@fitbeat.test`;
const TEST_PASSWORD = 'PerfTest123!';

// ──────────────────────────────────────────────────────────────
// Load profiles per scenario
// ──────────────────────────────────────────────────────────────
const profiles = {
  case1: {
    vus: 1,
    duration: '30s',
  },
  case2: {
    vus: 50,
    duration: '30s',
  },
  case3: {
    stages: [
      { duration: '30s', target: 1 },
      { duration: '30s', target: 50 },
      { duration: '30s', target: 200 },
      { duration: '30s', target: 500 },
      { duration: '30s', target: 2000 },
      { duration: '30s', target: 0 },
    ],
  },
};

export const options = {
  ...profiles[SCENARIO],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

// ──────────────────────────────────────────────────────────────
// Custom metrics
// ──────────────────────────────────────────────────────────────
const loginDuration = new Trend('login_duration_ms', true);
const loginFailRate = new Rate('login_fail_rate');

// ──────────────────────────────────────────────────────────────
// setup() — runs once before the test; registers the test user
// ──────────────────────────────────────────────────────────────
export function setup() {
  const payload = JSON.stringify({
    first_name: 'Perf',
    last_name: 'Test',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const res = http.post(`${BASE_URL}/api/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 201) {
    console.error(`[setup] Registration failed: ${res.status} — ${res.body}`);
  } else {
    console.log(`[setup] Test user registered: ${TEST_EMAIL}`);
  }

  return { email: TEST_EMAIL, password: TEST_PASSWORD };
}

// ──────────────────────────────────────────────────────────────
// default() — executed by every VU on every iteration
// ──────────────────────────────────────────────────────────────
export default function (data) {
  const payload = JSON.stringify({
    email: data.email,
    password: data.password,
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' },
  });

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has access_token': (r) => {
      try {
        return JSON.parse(r.body).access_token !== undefined;
      } catch (_) {
        return false;
      }
    },
  });

  loginDuration.add(res.timings.duration);
  loginFailRate.add(!ok);

  sleep(1);
}

// ──────────────────────────────────────────────────────────────
// teardown() — runs once after all VUs finish
// ──────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log(`[teardown] Test completed. User: ${data.email}`);
}
