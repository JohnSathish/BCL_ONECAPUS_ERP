/**
 * Local Android App Bundle (AAB) for Play upload testing.
 * Prefer EAS production for real Play signing: npm run build:prod:android
 *
 * Requires upload keystore via android/keystore.properties (see keystore.properties.example).
 * Usage: npm run build:aab
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

const jdkCandidates = [
  process.env.JAVA_HOME,
  'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.16.8-hotspot',
  'C:\\Program Files\\Java\\jdk-17',
].filter(Boolean);

const javaHome = jdkCandidates.find((p) => fs.existsSync(path.join(p, 'bin', 'java.exe')));
if (!javaHome) {
  console.error('JDK 17 not found. Install Temurin/OpenJDK 17 and retry.');
  process.exit(1);
}

const arches = process.env.REACT_NATIVE_ARCHITECTURES || 'arm64-v8a,armeabi-v7a';
const skipClean = process.env.SKIP_PREBUILD_CLEAN === '1';
const allowDebug = process.env.ALLOW_DEBUG_RELEASE_SIGNING === '1';

const keystoreProps = path.join(root, 'android', 'keystore.properties');
const credentialsJson = path.join(root, 'credentials.json');
let downloadedCredentialEnv = {};
if (fs.existsSync(credentialsJson)) {
  const credentials = JSON.parse(fs.readFileSync(credentialsJson, 'utf8'));
  const keystore = credentials.android?.keystore;
  if (keystore) {
    const keystorePath = path.resolve(root, keystore.keystorePath);
    if (!fs.existsSync(keystorePath)) {
      console.error(`Downloaded Android keystore is missing: ${keystorePath}`);
      process.exit(1);
    }
    downloadedCredentialEnv = {
      MYAPP_UPLOAD_STORE_FILE: keystorePath,
      MYAPP_UPLOAD_STORE_PASSWORD: keystore.keystorePassword,
      MYAPP_UPLOAD_KEY_ALIAS: keystore.keyAlias,
      MYAPP_UPLOAD_KEY_PASSWORD: keystore.keyPassword,
    };
  }
}
const hasUploadCredentials =
  fs.existsSync(keystoreProps) ||
  Object.values(downloadedCredentialEnv).every(
    (value) => typeof value === 'string' && value.length > 0,
  );
if (!hasUploadCredentials && !allowDebug) {
  console.error(
    'Missing credentials.json or android/keystore.properties (upload key). Download EAS credentials or use EAS:\n' +
      '  npm run build:prod:android\n' +
      'For smoke only: ALLOW_DEBUG_RELEASE_SIGNING=1 npm run build:aab',
  );
  process.exit(1);
}

const googleServices = path.join(root, 'google-services.json');
if (!fs.existsSync(googleServices)) {
  console.error(
    'Missing apps/mobile/google-services.json — required for FCM push.\n' +
      'Download it from Firebase Console for package edu.onecampus.mobile.',
  );
  process.exit(1);
}

const env = {
  ...process.env,
  ...downloadedCredentialEnv,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
  LOCAL_NATIVE_RELEASE: '1',
  EAS_BUILD_PROFILE: process.env.EAS_BUILD_PROFILE || 'production',
  // Force app.config to wire Firebase even when EAS_BUILD_PROFILE is set.
  GOOGLE_SERVICES_JSON: process.env.GOOGLE_SERVICES_JSON || googleServices,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://erp.donboscocollege.ac.in/api',
  EXPO_PUBLIC_TENANT_SLUG: process.env.EXPO_PUBLIC_TENANT_SLUG || 'demo',
  EXPO_PUBLIC_APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Don Bosco College, Tura',
  ORG_GRADLE_PROJECT_reactNativeArchitectures: arches,
};

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env,
    cwd: opts.cwd || root,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

console.log('Building release AAB…');
const prebuildArgs = ['expo', 'prebuild', '--platform', 'android'];
if (!skipClean) prebuildArgs.push('--clean');
run('npx', prebuildArgs);

// Ensure monorepo Metro assets survive R8 resource shrinking after clean prebuild.
const keepDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'raw');
fs.mkdirSync(keepDir, { recursive: true });
fs.writeFileSync(
  path.join(keepDir, 'keep.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@raw/*,@drawable/*,@mipmap/*" />
`,
);

/**
 * Expo prebuild --clean regenerates app/build.gradle with debug release signing.
 * Re-inject upload-keystore wiring when local upload credentials are present.
 */
function ensureUploadSigningInGradle() {
  const appGradle = path.join(root, 'android', 'app', 'build.gradle');
  if (!fs.existsSync(appGradle)) return;
  let text = fs.readFileSync(appGradle, 'utf8');
  if (text.includes('hasUploadKeystore')) {
    console.log('Upload keystore signing already present in app/build.gradle');
    return;
  }
  if (!hasUploadCredentials && !allowDebug) {
    console.error(
      'app/build.gradle missing upload signing and local upload credentials are absent.',
    );
    process.exit(1);
  }
  if (!text.includes('hasUploadKeystore') && hasUploadCredentials) {
    const inject = `
// Upload keystore for Play Store (never commit the .jks).
def keystorePropertiesFile = rootProject.file('keystore.properties')
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
def uploadStoreFile = System.getenv('MYAPP_UPLOAD_STORE_FILE') ?: keystoreProperties['MYAPP_UPLOAD_STORE_FILE'] ?: findProperty('MYAPP_UPLOAD_STORE_FILE')
def uploadStorePassword = System.getenv('MYAPP_UPLOAD_STORE_PASSWORD') ?: keystoreProperties['MYAPP_UPLOAD_STORE_PASSWORD'] ?: findProperty('MYAPP_UPLOAD_STORE_PASSWORD')
def uploadKeyAlias = System.getenv('MYAPP_UPLOAD_KEY_ALIAS') ?: keystoreProperties['MYAPP_UPLOAD_KEY_ALIAS'] ?: findProperty('MYAPP_UPLOAD_KEY_ALIAS')
def uploadKeyPassword = System.getenv('MYAPP_UPLOAD_KEY_PASSWORD') ?: keystoreProperties['MYAPP_UPLOAD_KEY_PASSWORD'] ?: findProperty('MYAPP_UPLOAD_KEY_PASSWORD')
def uploadStore = uploadStoreFile ? rootProject.file(uploadStoreFile) : null
def hasUploadKeystore = uploadStore?.exists() && uploadStorePassword && uploadKeyAlias && uploadKeyPassword
`;
    text = text.replace(/\ndef jscFlavor = /, `${inject}\ndef jscFlavor = `);
    if (!text.includes('signingConfigs {')) {
      console.error('Could not locate signingConfigs in app/build.gradle');
      process.exit(1);
    }
    text = text.replace(/signingConfigs \{\s*debug \{[\s\S]*?\}(\s*)\}/, (block) => {
      if (block.includes('release {')) return block;
      return block.replace(
        /(\s*)\}(\s*)$/,
        `$1    release {
$1        if (hasUploadKeystore) {
$1            storeFile uploadStore
$1            storePassword uploadStorePassword
$1            keyAlias uploadKeyAlias
$1            keyPassword uploadKeyPassword
$1        }
$1    }
$1}$2`,
      );
    });
    const buildTypesStart = text.indexOf('    buildTypes {');
    const packagingOptionsStart = text.indexOf('    packagingOptions {', buildTypesStart);
    if (buildTypesStart === -1 || packagingOptionsStart === -1) {
      console.error('Could not locate buildTypes in app/build.gradle');
      process.exit(1);
    }
    const buildTypesBlock = text.slice(buildTypesStart, packagingOptionsStart);
    const signedBuildTypesBlock = buildTypesBlock.replace(
      /(\n        release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1${[
        'if (hasUploadKeystore) {',
        '                signingConfig signingConfigs.release',
        "            } else if (findProperty('ALLOW_DEBUG_RELEASE_SIGNING') == 'true') {",
        '                signingConfig signingConfigs.debug',
        '            } else {',
        '                throw new GradleException(',
        "                    'Release signing requires android/keystore.properties '",
        "                    + '(see keystore.properties.example) or set MYAPP_UPLOAD_* env vars, '",
        "                    + 'or ALLOW_DEBUG_RELEASE_SIGNING=true for local smoke only.')",
        '            }',
      ].join('\n')}`,
    );
    if (signedBuildTypesBlock === buildTypesBlock) {
      console.error('Could not replace debug release signing in app/build.gradle');
      process.exit(1);
    }
    text =
      text.slice(0, buildTypesStart) + signedBuildTypesBlock + text.slice(packagingOptionsStart);
    fs.writeFileSync(appGradle, text);
    console.log('Patched app/build.gradle → upload keystore release signing');
  }
}

ensureUploadSigningInGradle();

const appGradle = path.join(root, 'android', 'app', 'build.gradle');
if (fs.existsSync(appGradle)) {
  let gradleText = fs.readFileSync(appGradle, 'utf8');
  if (gradleText.includes('proguard-android.txt')) {
    gradleText = gradleText.replace('proguard-android.txt', 'proguard-android-optimize.txt');
    fs.writeFileSync(appGradle, gradleText);
    console.log('Patched release ProGuard defaults → proguard-android-optimize.txt');
  }
}

const gradleArgs = [
  'bundleRelease',
  '--no-daemon',
  '--max-workers=2',
  `-PreactNativeArchitectures=${arches}`,
];
if (allowDebug) gradleArgs.push('-PALLOW_DEBUG_RELEASE_SIGNING=true');

run('.\\gradlew.bat', gradleArgs, { cwd: path.join(root, 'android') });

const aabPath = path.join(
  root,
  'android',
  'app',
  'build',
  'outputs',
  'bundle',
  'release',
  'app-release.aab',
);
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(aabPath)) {
  const dest = path.join(distDir, 'DonBoscoCollege-Tura-v1.0.6-vc26.aab');
  const destR8 = path.join(distDir, 'onecampus-v26-sdk36.aab');
  fs.copyFileSync(aabPath, dest);
  fs.copyFileSync(aabPath, destR8);
  console.log('\nAAB:', aabPath);
  console.log('Copy:', dest);
  console.log('Copy:', destR8);
  if (allowDebug) {
    console.log('WARNING: debug-signed — do not upload to Play Console.');
  }
} else {
  console.log('Expected AAB missing at', aabPath);
  process.exit(1);
}
