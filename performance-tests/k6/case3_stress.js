/**
 * FitBeat — Case 3: Stress Test (staged ramp-up to 2000 VUs)
 *
 * Stages:
 *   0 → 1   VU  in 30s  (warm-up)
 *   1 → 50  VUs in 30s  (normal load)
 *   50 → 200 VUs in 30s (moderate stress)
 *   200 → 500 VUs in 30s (high stress)
 *   500 → 2000 VUs in 30s (peak / breaking point)
 *   2000 → 0  VUs in 30s  (cool-down)
 *
 * The "knee of the curve" is the stage where p(95) starts growing
 * steeply or http_req_failed > 0 for the first time.
 *
 * Usage:
 *   k6 run case3_stress.js
 *   k6 run --out json=results.json case3_stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8090';

export const options = {
  stages: [
    { duration: '30s', target: 1 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 2000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Alert if p(95) exceeds 5 seconds — captures breaking point
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.10'],
  },
};

const loginP95 = new Trend('login_p95_ms', true);
const failCount = new Counter('login_failures');
const failRate = new Rate('login_fail_rate');

export function setup() {
  const email = `perf_stress_${Date.now()}@fitbeat.test`;
  const password = 'StressTest123!';

  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ first_name: 'Stress', last_name: 'Test', email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 201) {
    console.error(`[setup] Registration failed: ${res.status} — ${res.body}`);
  } else {
    console.log(`[setup] Stress test user registered: ${email}`);
  }

  return { email, password };
}

export default function (data) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: data.email, password: data.password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'login', test: 'stress' },
    }
  );

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 3s': (r) => r.timings.duration < 3000,
    'has access_token': (r) => {
      try { return JSON.parse(r.body).access_token !== undefined; }
      catch (_) { return false; }
    },
  });

  loginP95.add(res.timings.duration);
  failRate.add(!ok);

  if (!ok) {
    failCount.add(1);
    console.warn(`[VU ${__VU}] Login failed at ${new Date().toISOString()} — status=${res.status}`);
  }

  sleep(1);
}

export function teardown(data) {
  console.log(`[teardown] Stress test completed. Check login_p95_ms and login_fail_rate for knee point.`);
}
