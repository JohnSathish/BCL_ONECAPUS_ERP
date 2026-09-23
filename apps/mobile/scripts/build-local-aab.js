/**
 * Local Android App Bundle (AAB) for Play upload.
 * Requires upload keystore via credentials.json or android/keystore.properties.
 * Usage: npm run build:aab
 *
 * Enforces API 36+, edge-to-edge gradle flags, R8, and bitmap crunch for Play scores.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
process.chdir(root);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appVersion = pkg.version || '1.0.25';
const versionCode = '45';

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

function copyOut(src, name) {
  const distDir = path.join(root, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const dest = path.join(distDir, name);
  fs.copyFileSync(src, dest);
  const desktop = path.join(os.homedir(), 'Desktop', name);
  try {
    fs.copyFileSync(src, desktop);
    console.log('Desktop:', desktop);
  } catch {
    console.warn('Could not copy to Desktop:', desktop);
  }
  console.log('Copy:', dest);
  return dest;
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
      '\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=768m -XX:+HeapDumpOnOutOfMemoryError\n';
  } else {
    text = text.replace(
      /^org\.gradle\.jvmargs=.*$/m,
      'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=768m -XX:+HeapDumpOnOutOfMemoryError',
    );
  }
  if (!/^org\.gradle\.workers\.max=/m.test(text)) {
    text += '\norg.gradle.workers.max=1\n';
  } else {
    text = text.replace(/^org\.gradle\.workers\.max=.*$/m, 'org.gradle.workers.max=1');
  }
  const sdkProps = {
    'android.compileSdkVersion': '36',
    'android.targetSdkVersion': '36',
    'android.buildToolsVersion': '36.0.0',
    'android.enableProguardInReleaseBuilds': 'true',
    'android.enableShrinkResourcesInReleaseBuilds': 'true',
    'android.enablePngCrunchInReleaseBuilds': 'true',
    'expo.edgeToEdgeEnabled': 'true',
  };
  for (const [key, value] of Object.entries(sdkProps)) {
    const line = `${key}=${value}`;
    if (new RegExp(`^${key.replace(/\./g, '\\.')}=`, 'm').test(text)) {
      text = text.replace(new RegExp(`^${key.replace(/\./g, '\\.')}=.*$`, 'm'), line);
    } else {
      text += `\n${line}\n`;
    }
  }
  fs.writeFileSync(gp, text);
  console.log(
    `Patched android/gradle.properties → architectures=${arches}, workers=1, heap=4g, targetSdk=36`,
  );
}

function patchAndroidSdkGradleFiles() {
  const files = [
    path.join(root, 'android', 'build.gradle'),
    path.join(root, 'android', 'app', 'build.gradle'),
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = before
      .replace(
        /findProperty\('android\.compileSdkVersion'\)\s*\?:\s*'\d+'/g,
        "findProperty('android.compileSdkVersion') ?: '36'",
      )
      .replace(
        /findProperty\('android\.targetSdkVersion'\)\s*\?:\s*'\d+'/g,
        "findProperty('android.targetSdkVersion') ?: '36'",
      )
      .replace(
        /findProperty\('android\.buildToolsVersion'\)\s*\?:\s*'[\d.]+'/g,
        "findProperty('android.buildToolsVersion') ?: '36.0.0'",
      );
    if (after !== before) {
      fs.writeFileSync(file, after);
      console.log(`Patched ${path.relative(root, file)} → SDK 36 defaults`);
    }
  }
}

function assertTargetSdk36() {
  const gp = path.join(root, 'android', 'gradle.properties');
  const text = fs.existsSync(gp) ? fs.readFileSync(gp, 'utf8') : '';
  const target = (text.match(/^android\.targetSdkVersion=(\d+)/m) || [])[1];
  const compile = (text.match(/^android\.compileSdkVersion=(\d+)/m) || [])[1];
  if (Number(target) < 36 || Number(compile) < 36) {
    throw new Error(
      `Play Console requires API 36+. Found android.targetSdkVersion=${target || 'unset'} ` +
        `android.compileSdkVersion=${compile || 'unset'} in android/gradle.properties.`,
    );
  }
  console.log(`Android SDK OK → compileSdk ${compile}, targetSdk ${target}`);
}

function ensureProguardRules() {
  const rules = path.join(root, 'android', 'app', 'proguard-rules.pro');
  const dir = path.dirname(rules);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(rules)) {
    fs.writeFileSync(
      rules,
      `# OneCampus college release R8
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
`,
    );
  }
  console.log('Wrote android/app/proguard-rules.pro for R8 release builds');
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
    canvas.save(p, 'PNG', optimize=True, compress_level=9)
    print('splash', folder, canvas.size, os.path.getsize(p))

for dirpath, _, files in os.walk(root):
    for name in files:
        if not name.lower().endswith('.png'):
            continue
        p = os.path.join(dirpath, name)
        try:
            before = os.path.getsize(p)
            if before < 40_000:
                continue
            im = Image.open(p).convert('RGBA')
            im.save(p, 'PNG', optimize=True, compress_level=9)
            after = os.path.getsize(p)
            if after < before:
                print('crunch', os.path.relpath(p, root), before, '->', after)
        except Exception as e:
            print('skip', p, e)
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

function verifyReleaseManifest() {
  const candidates = [
    path.join(
      root,
      'android',
      'app',
      'build',
      'intermediates',
      'merged_manifests',
      'release',
      'processReleaseManifest',
      'AndroidManifest.xml',
    ),
    path.join(
      root,
      'android',
      'app',
      'build',
      'intermediates',
      'merged_manifests',
      'release',
      'AndroidManifest.xml',
    ),
    path.join(
      root,
      'android',
      'app',
      'build',
      'intermediates',
      'packaged_manifests',
      'release',
      'AndroidManifest.xml',
    ),
  ];
  const manifest = candidates.find((p) => fs.existsSync(p));
  if (!manifest) {
    console.warn('Could not find merged release manifest to verify targetSdk.');
    return;
  }
  const xml = fs.readFileSync(manifest, 'utf8');
  const target = (xml.match(/android:targetSdkVersion="(\d+)"/) || [])[1];
  const compileHint = (xml.match(/android:compileSdkVersion="(\d+)"/) || [])[1];
  const pkgName = (xml.match(/package="([^"]+)"/) || [])[1];
  const vc = (xml.match(/android:versionCode="(\d+)"/) || [])[1];
  const vn = (xml.match(/android:versionName="([^"]+)"/) || [])[1];
  console.log(
    `Release manifest → package=${pkgName || 'edu.onecampus.mobile'} versionName=${vn || appVersion} versionCode=${vc || versionCode} compileSdk=${compileHint || 'n/a'} targetSdk=${target || 'unset'}`,
  );
  if (Number(target) < 36) {
    throw new Error(`Release manifest still targets API ${target}. Play Console requires 36+.`);
  }
}

function copyMappingFile(base) {
  const mapping = path.join(
    root,
    'android',
    'app',
    'build',
    'outputs',
    'mapping',
    'release',
    'mapping.txt',
  );
  if (!fs.existsSync(mapping)) {
    console.log('No R8 mapping.txt found (Play deobfuscation upload optional).');
    return;
  }
  copyOut(mapping, `${base}-mapping.txt`);
}

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

console.log('JAVA_HOME =', javaHome);
console.log(`Package = edu.onecampus.mobile`);
console.log(`Version = ${appVersion} versionCode ${versionCode}`);
console.log('Architectures =', arches);
console.log('Building Don Bosco College Play AAB (API 36)…');

const prebuildArgs = ['expo', 'prebuild', '--platform', 'android'];
if (!skipClean) prebuildArgs.push('--clean');
run('npx', prebuildArgs);

patchGradleProperties();
patchAndroidSdkGradleFiles();
assertTargetSdk36();
ensureProguardRules();
shrinkSplashLogos();

const keepDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'raw');
fs.mkdirSync(keepDir, { recursive: true });
fs.writeFileSync(
  path.join(keepDir, 'keep.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@raw/*,@drawable/*,@mipmap/*" />
`,
);

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
  '--max-workers=1',
  `-PreactNativeArchitectures=${arches}`,
];
if (allowDebug) gradleArgs.push('-PALLOW_DEBUG_RELEASE_SIGNING=true');

run('.\\gradlew.bat', gradleArgs, { cwd: path.join(root, 'android') });

verifyReleaseManifest();

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
const base = `DonBoscoCollege-Tura-v${appVersion}-vc${versionCode}`;
if (!fs.existsSync(aabPath)) {
  console.error('Expected AAB missing at', aabPath);
  process.exit(1);
}

console.log('\n=== Don Bosco College Android release complete ===');
console.log('AAB:', aabPath);
copyOut(aabPath, `${base}.aab`);
copyMappingFile(base);
console.log('Android package: edu.onecampus.mobile');
console.log('Play Console: upload the .aab (targetSdk 36).');
if (allowDebug) {
  console.log('WARNING: debug-signed — do not upload to Play Console.');
}
