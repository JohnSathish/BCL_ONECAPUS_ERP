/**
 * Local native Android release APK for St. Luke's School only.
 * Usage from apps/school-mobile: npm run build:apk
 *
 * Package: in.stlukestura.school  (never edu.onecampus.mobile)
 * API:     https://erp.stlukestura.in/api
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

const arches = process.env.REACT_NATIVE_ARCHITECTURES || 'arm64-v8a';
const skipClean = process.env.SKIP_PREBUILD_CLEAN === '1';
const googleServices = path.join(root, 'google-services.json');

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
  LOCAL_NATIVE_RELEASE: '1',
  EAS_BUILD_PROFILE: process.env.EAS_BUILD_PROFILE || 'preview',
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://erp.stlukestura.in/api',
  EXPO_PUBLIC_TENANT_SLUG: process.env.EXPO_PUBLIC_TENANT_SLUG || 'st-lukes-tura',
  EXPO_PUBLIC_APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || "St. Luke's School",
  EXPO_PUBLIC_LOGIN_HOST: process.env.EXPO_PUBLIC_LOGIN_HOST || 'erp.stlukestura.in',
  ORG_GRADLE_PROJECT_reactNativeArchitectures: arches,
  ORG_GRADLE_PROJECT_ALLOW_DEBUG_RELEASE_SIGNING: 'true',
};

if (fs.existsSync(googleServices)) {
  env.GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON || googleServices;
} else {
  console.log('No google-services.json — building without Firebase (push optional).');
}

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}\n`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env,
    cwd: opts.cwd || root,
  });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

function shrinkSplashLogos() {
  const pyPath = path.join(root, 'scripts', '_shrink_splash.py');
  fs.writeFileSync(
    pyPath,
    `from PIL import Image
import os
root = r'''${path.join(root, 'android', 'app', 'src', 'main', 'res')}'''
sizes = {
    'drawable-mdpi': 160,
    'drawable-hdpi': 240,
    'drawable-xhdpi': 320,
    'drawable-xxhdpi': 480,
    'drawable-xxxhdpi': 640,
}
for folder, px in sizes.items():
    p = os.path.join(root, folder, 'splashscreen_logo.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGBA')
    im.thumbnail((px, px), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    x = (px - im.width) // 2
    y = (px - im.height) // 2
    canvas.paste(im, (x, y), im)
    canvas.save(p, 'PNG')
    print('splash', folder, canvas.size)
`,
  );
  const r = spawnSync('python', [pyPath], { stdio: 'inherit', cwd: root });
  try {
    fs.unlinkSync(pyPath);
  } catch {
    /* ignore */
  }
  if (r.status !== 0) {
    console.warn('Could not shrink splash logos; continuing.');
  }
}

function stripFirebaseMessagingIfNeeded() {
  if (fs.existsSync(googleServices)) return;
  const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) return;
  let xml = fs.readFileSync(manifestPath, 'utf8');
  if (!xml.includes('xmlns:tools=')) {
    xml = xml.replace(
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android"',
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"',
    );
  }
  if (!xml.includes('ExpoFirebaseMessagingService')) {
    xml = xml.replace(
      '</application>',
      `    <service android:name="expo.modules.notifications.service.ExpoFirebaseMessagingService" tools:node="remove"/>
  </application>`,
    );
    fs.writeFileSync(manifestPath, xml);
    console.log('Removed Expo Firebase messaging service (no google-services.json).');
  }
}

function patchGradleProperties() {
  const gp = path.join(root, 'android', 'gradle.properties');
  if (!fs.existsSync(gp)) return;
  let text = fs.readFileSync(gp, 'utf8');
  if (/^reactNativeArchitectures=/m.test(text)) {
    text = text.replace(/^reactNativeArchitectures=.*$/m, `reactNativeArchitectures=${arches}`);
  } else {
    text += `\nreactNativeArchitectures=${arches}\n`;
  }
  if (!/^org\.gradle\.jvmargs=/m.test(text)) {
    text +=
      '\norg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError\n';
  } else {
    text = text.replace(
      /^org\.gradle\.jvmargs=.*$/m,
      'org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError',
    );
  }
  if (!/^org\.gradle\.workers\.max=/m.test(text)) {
    text += '\norg.gradle.workers.max=2\n';
  } else {
    text = text.replace(/^org\.gradle\.workers\.max=.*$/m, 'org.gradle.workers.max=2');
  }
  fs.writeFileSync(gp, text);
  console.log(`Patched android/gradle.properties → architectures=${arches}, workers=2`);
}

console.log('JAVA_HOME =', javaHome);
console.log('Package = in.stlukestura.school');
console.log('Architectures =', arches);
console.log("Building St. Luke's School APK (college app untouched)…");

const prebuildArgs = ['expo', 'prebuild', '--platform', 'android'];
if (!skipClean) prebuildArgs.push('--clean');
run('npx', prebuildArgs);
patchGradleProperties();
shrinkSplashLogos();
stripFirebaseMessagingIfNeeded();

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
  }
}

run(
  '.\\gradlew.bat',
  [
    'assembleRelease',
    '--no-daemon',
    '--max-workers=2',
    `-PreactNativeArchitectures=${arches}`,
    '-PALLOW_DEBUG_RELEASE_SIGNING=true',
  ],
  { cwd: path.join(root, 'android') },
);

const apkDir = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release');
const apks = fs.existsSync(apkDir) ? fs.readdirSync(apkDir).filter((f) => f.endsWith('.apk')) : [];

const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const destName = `StLukes-School-v1.0.1-${arches.replace(/,/g, '-')}.apk`;
const dest = path.join(distDir, destName);

console.log('\n=== St. Luke school APK complete ===');
if (apks.length) {
  const src = path.join(apkDir, apks[0]);
  fs.copyFileSync(src, dest);
  const desktop = path.join(os.homedir(), 'Desktop', destName);
  try {
    fs.copyFileSync(src, desktop);
    console.log('Desktop:', desktop);
  } catch (err) {
    console.log('Could not copy to Desktop:', err.message);
  }
  console.log('APK:', src);
  console.log('Copy:', dest);
  console.log('Android package: in.stlukestura.school');
} else {
  console.log('Look under:', apkDir);
}
