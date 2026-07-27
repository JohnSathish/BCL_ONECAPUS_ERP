const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const credentials = require(path.join(root, 'credentials.json'));
const keystore = credentials.android.keystore;
const keystorePath = path.resolve(root, keystore.keystorePath);
const javaHome =
  [process.env.JAVA_HOME, 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.16.8-hotspot'].find(
    (p) => p && fs.existsSync(path.join(p, 'bin', 'keytool.exe')),
  ) || process.env.JAVA_HOME;
const keytool = path.join(javaHome, 'bin', 'keytool.exe');

function sha256FromKeytool(args, envPass) {
  const r = spawnSync(keytool, args, {
    encoding: 'utf8',
    env: { ...process.env, ...envPass },
  });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const match = out.match(/SHA256:\s*([0-9A-F:]+)/i);
  return { ok: r.status === 0 && !!match, sha256: match?.[1] || null, raw: out.slice(0, 500) };
}

const store = sha256FromKeytool(
  [
    '-list',
    '-v',
    '-keystore',
    keystorePath,
    '-alias',
    keystore.keyAlias,
    '-storepass',
    keystore.keystorePassword,
  ],
  {},
);

// bundletool may not exist; try jarsigner -verify on previous AAB is weak.
// Prefer extracting cert from previous AAB via keytool -printcert if we can unzip META-INF.
const prevAab = path.join(root, 'dist', 'DonBoscoCollege-Tura-v1.0.2-vc22.aab');
let prevSha = null;
if (fs.existsSync(prevAab)) {
  const tmp = path.join(root, 'dist', '_aab_cert_probe');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // AAB is a zip; look for *.RSA / *.DSA
  const unzip = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${prevAab.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force`,
    ],
    { encoding: 'utf8' },
  );
  // Expand-Archive may fail on .aab extension — use .NET ZipFile
  if (!fs.existsSync(path.join(tmp, 'META-INF'))) {
    spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${prevAab.replace(/'/g, "''")}', '${tmp.replace(/'/g, "''")}')`,
      ],
      { encoding: 'utf8' },
    );
  }
  const meta = path.join(tmp, 'META-INF');
  let certFile = null;
  if (fs.existsSync(meta)) {
    certFile = fs.readdirSync(meta).find((f) => /\.(RSA|DSA|EC)$/i.test(f));
  }
  if (certFile) {
    const printed = spawnSync(keytool, ['-printcert', '-file', path.join(meta, certFile)], {
      encoding: 'utf8',
    });
    const out = `${printed.stdout || ''}\n${printed.stderr || ''}`;
    prevSha = (out.match(/SHA256:\s*([0-9A-F:]+)/i) || [])[1] || null;
  }
}

console.log(
  JSON.stringify(
    {
      uploadKeystoreSha256: store.sha256,
      previousAabSha256: prevSha,
      sameSigningCert: !!(store.sha256 && prevSha && store.sha256 === prevSha),
      keystorePathExists: fs.existsSync(keystorePath),
      previousAabExists: fs.existsSync(prevAab),
    },
    null,
    2,
  ),
);
