const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const c = require(path.join(root, 'credentials.json'));
const k = c.android?.keystore || {};
const kp = k.keystorePath ? path.resolve(root, k.keystorePath) : null;
console.log(
  JSON.stringify(
    {
      keystorePath: k.keystorePath,
      keystoreExists: !!(kp && fs.existsSync(kp)),
      keyAlias: k.keyAlias,
      hasPw: !!k.keystorePassword,
      hasKeyPw: !!k.keyPassword,
    },
    null,
    2,
  ),
);

function get(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body: body.slice(0, 300) }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
  });
}

(async () => {
  const api = 'https://erp.donboscocollege.ac.in/api';
  const checks = [
    ['health-or-root', `${api}/`],
    ['docs', `${api}/docs`],
  ];
  for (const [name, url] of checks) {
    const r = await get(url);
    console.log(name, r.status, r.body.replace(/\s+/g, ' ').slice(0, 120));
  }
})();
