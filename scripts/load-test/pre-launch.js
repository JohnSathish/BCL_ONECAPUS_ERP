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
 * Pre-launch load test for Don Bosco ERP.
 * npm run load:test
 */

export const options = {
  scenarios: {
    student_dashboard: {
      executor: 'constant-vus',
      vus: 200,
      duration: '2m',
      exec: 'studentDashboard',
    },
    admission_portal: {
      executor: 'constant-vus',
      vus: 500,
      duration: '2m',
      exec: 'admissionPortal',
      startTime: '30s',
    },
    fee_summary: {
      executor: 'constant-vus',
      vus: 300,
      duration: '2m',
      exec: 'feeSummary',
      startTime: '60s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.9'],
  },
};

const BASE = resolveBaseUrl();
const TENANT = resolveTenant();

export function studentDashboard() {
  const token = loginStudent(BASE, TENANT);
  if (!token) return;
  const opts = authHeaders(token, TENANT);
  const dash = http.get(`${BASE}/v1/students/me/dashboard`, opts);
  check(dash, { 'dashboard 200': (r) => r.status === 200 });
  const widget = http.get(`${BASE}/v1/students/me/dashboard/widgets/fees`, opts);
  check(widget, { 'fees widget 200': (r) => r.status === 200 });
  sleep(1);
}

export function admissionPortal() {
  const res = http.get(`${BASE}/v1/admissions/portal/info`, portalInfoHeaders(TENANT));
  check(res, { 'portal info 200': (r) => r.status === 200 });
  sleep(0.5);
}

export function feeSummary() {
  const token = loginStudent(BASE, TENANT);
  if (!token) return;
  const res = http.get(`${BASE}/v1/fees/me/summary`, authHeaders(token, TENANT));
  check(res, { 'fee summary 200': (r) => r.status === 200 });
  sleep(1);
}
