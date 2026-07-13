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
if (!fs.existsSync(keystoreProps) && !allowDebug) {
  console.error(
    'Missing android/keystore.properties (upload key). Copy keystore.properties.example or use EAS:\n' +
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
  const dest = path.join(distDir, 'DonBoscoCollege-Tura-v1.0.0.aab');
  const destR8 = path.join(distDir, 'onecampus-v18-sdk35.aab');
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
