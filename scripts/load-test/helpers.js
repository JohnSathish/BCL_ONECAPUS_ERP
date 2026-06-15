import http from 'k6/http';

export function resolveBaseUrl() {
  return __ENV.BASE_URL || 'http://localhost:3001/api';
}

export function resolveTenant() {
  return __ENV.TENANT_SLUG || 'demo';
}

export function authHeaders(token, tenant) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenant,
      'Content-Type': 'application/json',
    },
  };
}

export function portalInfoHeaders(tenant) {
  return {
    headers: {
      Host: `admissions.${tenant}.localhost`,
      'X-Tenant-Slug': tenant,
    },
  };
}

export function loginStudent(base, tenant) {
  const res = http.post(
    `${base}/v1/auth/login`,
    JSON.stringify({
      tenantSlug: tenant,
      email: __ENV.STUDENT_EMAIL || 'student@demo.edu',
      password: __ENV.STUDENT_PASSWORD || 'Student@123',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (!res.body || res.status < 200 || res.status >= 300) return '';
  try {
    const body = res.json();
    return body.accessToken ?? '';
  } catch {
    return '';
  }
}
