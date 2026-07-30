const fs = require('fs');
const path = require('path');

const root = __dirname.replace(/\\scripts$/, '').replace(/\/scripts$/, '');
const results = [];

function check(id, ok, detail) {
  results.push({ id, ok: !!ok, detail: String(detail) });
}

const credentialsPath = path.join(root, 'credentials.json');
const keystorePropsPath = path.join(root, 'android', 'keystore.properties');
const googleServicesPath = path.join(root, 'google-services.json');
const appConfigPath = path.join(root, 'app.config.ts');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
const releaseConstPath = path.join(root, 'src', 'constants', 'release.ts');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appConfig = fs.readFileSync(appConfigPath, 'utf8');
const gradle = fs.existsSync(gradlePath) ? fs.readFileSync(gradlePath, 'utf8') : '';
const releaseConst = fs.readFileSync(releaseConstPath, 'utf8');

const appVersion = (appConfig.match(/version:\s*'([^']+)'/) || [])[1];
const versionCode = Number((appConfig.match(/versionCode:\s*(\d+)/) || [])[1]);
const gradleVC = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1] || 0);
const gradleVN = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1];
const releaseAppVersion = (releaseConst.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
const packageId = (appConfig.match(/package:\s*'([^']+)'/) || [])[1];
const gradleAppId = (gradle.match(/applicationId\s+'([^']+)'/) || [])[1];

check('google-services', fs.existsSync(googleServicesPath), googleServicesPath);
check('package-id-config', packageId === 'edu.onecampus.mobile', packageId);
check(
  'package-id-gradle',
  !gradle || gradleAppId === 'edu.onecampus.mobile',
  gradleAppId || 'missing gradle',
);
check(
  'version-sync-package-json',
  packageJson.version === appVersion,
  `package.json=${packageJson.version} app.config=${appVersion}`,
);
check(
  'version-sync-release-const',
  releaseAppVersion === appVersion,
  `release.ts=${releaseAppVersion} app.config=${appVersion}`,
);
check(
  'version-sync-gradle',
  !gradle || (gradleVC === versionCode && gradleVN === appVersion),
  `gradle=${gradleVN}/${gradleVC} app.config=${appVersion}/${versionCode}`,
);
check('version-code-gt-26', versionCode > 26, `versionCode=${versionCode} (last Play AAB was 26)`);

let uploadOk = false;
let uploadDetail = 'missing credentials';
if (fs.existsSync(credentialsPath)) {
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const keystore = credentials.android?.keystore || {};
  const keystorePath = keystore.keystorePath ? path.resolve(root, keystore.keystorePath) : null;
  uploadOk = Boolean(
    keystorePath &&
    fs.existsSync(keystorePath) &&
    keystore.keystorePassword &&
    keystore.keyAlias &&
    keystore.keyPassword,
  );
  uploadDetail = JSON.stringify({
    source: 'credentials.json',
    keyAlias: keystore.keyAlias || null,
    keystoreExists: Boolean(keystorePath && fs.existsSync(keystorePath)),
  });
} else if (fs.existsSync(keystorePropsPath)) {
  uploadOk = true;
  uploadDetail = 'android/keystore.properties present';
}
check('upload-keystore', uploadOk, uploadDetail);

const jdkCandidates = [
  process.env.JAVA_HOME,
  'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.16.8-hotspot',
  'C:\\Program Files\\Java\\jdk-17',
].filter(Boolean);
const javaHome = jdkCandidates.find((p) => fs.existsSync(path.join(p, 'bin', 'java.exe')));
check('jdk17', Boolean(javaHome), javaHome || 'JDK 17 not found');

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
process.exit(failed.length ? 1 : 0);
