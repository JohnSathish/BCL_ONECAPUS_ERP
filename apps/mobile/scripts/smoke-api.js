const https = require('https');

function request(method, url, headers = {}, body) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers,
        timeout: 20000,
      },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () =>
          resolve({
            method,
            url,
            status: res.statusCode,
            ok: (res.statusCode || 0) < 500,
            snippet: String(data).replace(/\s+/g, ' ').slice(0, 160),
          }),
        );
      },
    );
    req.on('error', (e) => resolve({ method, url, status: 0, ok: false, snippet: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ method, url, status: 0, ok: false, snippet: 'timeout' });
    });
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const base = 'https://erp.donboscocollege.ac.in/api';
  const checks = [
    await request('GET', `${base}/v1/mobile-app/bootstrap?tenant=demo`),
    await request(
      'POST',
      `${base}/v1/auth/login`,
      {
        'Content-Type': 'application/json',
        'x-tenant-slug': 'demo',
      },
      JSON.stringify({ identifier: '__smoke__', password: '__invalid__' }),
    ),
    await request('GET', `${base}/v1/student/support/meta`, {
      Authorization: 'Bearer invalid',
      'x-tenant-slug': 'demo',
    }),
    await request('GET', `${base}/v1/student/support/chats`, {
      Authorization: 'Bearer invalid',
      'x-tenant-slug': 'demo',
    }),
    await request('GET', `${base}/v1/student/support/tickets`, {
      Authorization: 'Bearer invalid',
      'x-tenant-slug': 'demo',
    }),
    await request('GET', `${base}/v1/mobile-app/student/home`, {
      Authorization: 'Bearer invalid',
      'x-tenant-slug': 'demo',
    }),
  ];
  console.log(JSON.stringify({ checks }, null, 2));
  const failed = checks.filter((c) => !c.ok);
  process.exit(failed.length ? 1 : 0);
})();
