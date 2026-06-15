import { check, sleep } from 'k6';
import http from 'k6/http';
import {
  authHeaders,
  loginStudent,
  portalInfoHeaders,
  resolveBaseUrl,
  resolveTenant,
} from './helpers.js';

/**
 * Quick smoke load test — run before full pre-launch.js against staging.
 * npm run load:test:smoke
 */

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    checks: ['rate>0.5'],
  },
};

const BASE = resolveBaseUrl();
const TENANT = resolveTenant();

export default function () {
  const info = http.get(`${BASE}/v1/admissions/portal/info`, portalInfoHeaders(TENANT));
  check(info, { 'portal info': (r) => r.status === 200 });

  const token = loginStudent(BASE, TENANT);
  if (token) {
    const opts = authHeaders(token, TENANT);
    const dash = http.get(`${BASE}/v1/students/me/dashboard`, opts);
    check(dash, { dashboard: (r) => r.status === 200 });
    const summary = http.get(`${BASE}/v1/fees/me/summary`, opts);
    check(summary, { 'fee summary': (r) => r.status === 200 });
  }
  sleep(1);
}
