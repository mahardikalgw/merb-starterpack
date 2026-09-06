import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Auth flow stress test — targets the "stress-test" environment.
 *
 * Usage:
 *   k6 run infra/stress-test/k6/auth-flow.js -e BASE_URL=http://<server-ip>
 *   k6 run infra/stress-test/k6/auth-flow.js -e BASE_URL=https://stress.merb.example.com
 *
 * Override scenario with -e PROFILE=heavy (see options below).
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PROFILE = __ENV.PROFILE || 'default';

const profiles = {
  default: {
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 0 },
    ],
  },
  heavy: {
    stages: [
      { duration: '30s', target: 50 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
    ],
  },
};

export const options = {
  stages: (profiles[PROFILE] || profiles.default).stages,
  thresholds: {
    http_req_failed: ['rate<0.05'],        // <5% errors
    http_req_duration: ['p(95)<1500'],     // 95% under 1.5s
  },
};

export default function () {
  const suffix = Math.floor(Math.random() * 1_000_000);

  // 1. Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  // 2. Register
  const email = `k6-user-${suffix}-${Date.now()}@stress.test`;
  const register = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ name: `K6 User ${suffix}`, email, password: 'Password123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(register, {
    'register 201': (r) => r.status === 201,
  });

  // 3. Login
  const login = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password: 'Password123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, {
    'login 200': (r) => r.status === 200,
    'login returns token': (r) => r.json('accessToken') !== undefined,
  });

  sleep(1);
}
