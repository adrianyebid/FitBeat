/**
 * FitBeat — Case 2: Load Test (50 VUs)
 *
 * Usage:
 *   k6 run case2_load.js
 *   k6 run -e BASE_URL=http://my-host:8090 case2_load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8090';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const email = `perf_load_${Date.now()}@fitbeat.test`;
  const password = 'LoadTest123!';

  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ first_name: 'Load', last_name: 'Test', email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status !== 201) {
    console.error(`[setup] Registration failed: ${res.status}`);
  }

  return { email, password };
}

export default function (data) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: data.email, password: data.password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has accessToken': (r) => {
      try { return JSON.parse(r.body).accessToken !== undefined; }
      catch (_) { return false; }
    },
  });

  sleep(1);
}
