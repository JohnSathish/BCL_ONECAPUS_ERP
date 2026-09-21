/**
 * Local native Android APK + Play AAB for St. Luke's School only.
 * Usage from apps/school-mobile: npm run build:apk
 *
 * Package: in.stlukestura.school  (never edu.onecampus.mobile)
 * API:     https://erp.stlukestura.in/api
 *
 * iOS is not built here — use EAS later: npm run build:prod:ios
 */
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
process.chdir(root);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appVersion = pkg.version || '1.0.6';
const versionCode = '27';

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
const googleServices = path.join(root, 'google-services.json');
const keytool = path.join(javaHome, 'bin', 'keytool.exe');
const credDir = path.join(root, 'credentials', 'android');
const credJson = path.join(root, 'credentials.json');
const keystorePath = path.join(credDir, 'stlukes-upload.jks');

function ensureUploadKeystore() {
  if (fs.existsSync(credJson) && fs.existsSync(keystorePath)) {
    const credentials = JSON.parse(fs.readFileSync(credJson, 'utf8'));
    const ks = credentials.android?.keystore;
    if (ks?.keystorePassword && ks.keyAlias && ks.keyPassword) {
      return {
        MYAPP_UPLOAD_STORE_FILE: path.resolve(root, ks.keystorePath),
        MYAPP_UPLOAD_STORE_PASSWORD: ks.keystorePassword,
        MYAPP_UPLOAD_KEY_ALIAS: ks.keyAlias,
        MYAPP_UPLOAD_KEY_PASSWORD: ks.keyPassword,
      };
    }
  }
  fs.mkdirSync(credDir, { recursive: true });
  const storePass = crypto.randomBytes(16).toString('hex');
  const keyPass = crypto.randomBytes(16).toString('hex');
  const alias = 'stlukes-upload';
  console.log('Generating St. Luke’s Play upload keystore (keep credentials/ backed up)…');
  const r = spawnSync(
    keytool,
    [
      '-genkeypair',
      '-v',
      '-storetype',
      'JKS',
      '-keystore',
      keystorePath,
      '-alias',
      alias,
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-storepass',
      storePass,
      '-keypass',
      keyPass,
      '-dname',
      "CN=St Luke's School, OU=Mobile, O=St Lukes Tura, L=Tura, ST=Meghalaya, C=IN",
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error('keytool failed; cannot sign Play AAB.');
    process.exit(1);
  }
  const rel = path.posix.join('credentials', 'android', 'stlukes-upload.jks');
  fs.writeFileSync(
    credJson,
    JSON.stringify(
      {
        android: {
          keystore: {
            keystorePath: rel.replace(/\\/g, '/'),
            keystorePassword: storePass,
            keyAlias: alias,
            keyPassword: keyPass,
          },
        },
      },
      null,
      2,
    ),
  );
  return {
    MYAPP_UPLOAD_STORE_FILE: keystorePath,
    MYAPP_UPLOAD_STORE_PASSWORD: storePass,
    MYAPP_UPLOAD_KEY_ALIAS: alias,
    MYAPP_UPLOAD_KEY_PASSWORD: keyPass,
  };
}

const uploadEnv = ensureUploadKeystore();

const env = {
  ...process.env,
  ...uploadEnv,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
  LOCAL_NATIVE_RELEASE: '1',
  EAS_BUILD_PROFILE: process.env.EAS_BUILD_PROFILE || 'production',
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://erp.stlukestura.in/api',
  EXPO_PUBLIC_TENANT_SLUG: process.env.EXPO_PUBLIC_TENANT_SLUG || 'st-lukes-tura',
  EXPO_PUBLIC_APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || "St. Luke's School",
  EXPO_PUBLIC_LOGIN_HOST: process.env.EXPO_PUBLIC_LOGIN_HOST || 'erp.stlukestura.in',
  ORG_GRADLE_PROJECT_reactNativeArchitectures: arches,
};

if (fs.existsSync(googleServices)) {
  env.GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON || googleServices;
  console.log(
    'Firebase google-services.json found (st-lukes-school-6f471) — FCM will be included.',
  );
} else {
  console.error(
    'Missing apps/school-mobile/google-services.json. Download it from Firebase project st-lukes-school-6f471 for package in.stlukestura.school, then retry.',
  );
  process.exit(1);
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

function ensureProguardRules() {
  const rulesPath = path.join(root, 'android', 'app', 'proguard-rules.pro');
  const rules = `# St. Luke's School — R8 keep rules (Play memory/performance score)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*,Signature,Exceptions,InnerClasses,EnclosingMethod
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.zoontek.rnedgetoedge.** { *; }
`;
  fs.writeFileSync(rulesPath, rules);
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

# Re-encode oversized mipmap/drawable bitmaps (Play bitmap optimization).
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
      'processReleaseManifest',
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
  const pkg = (xml.match(/package="([^"]+)"/) || [])[1];
  const vc = (xml.match(/android:versionCode="(\d+)"/) || [])[1];
  const vn = (xml.match(/android:versionName="([^"]+)"/) || [])[1];
  console.log(
    `Release manifest → package=${pkg || 'in.stlukestura.school'} versionName=${vn || appVersion} versionCode=${vc || versionCode} compileSdk=${compileHint || 'n/a'} targetSdk=${target || 'unset'}`,
  );
  if (Number(target) < 36) {
    throw new Error(`Release manifest still targets API ${target}. Play Console requires 36+.`);
  }
}

function copyMappingFile(distDir, base) {
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

function ensureUploadSigningInGradle() {
  const appGradle = path.join(root, 'android', 'app', 'build.gradle');
  if (!fs.existsSync(appGradle)) return;
  let text = fs.readFileSync(appGradle, 'utf8');
  if (text.includes('hasUploadKeystore')) {
    console.log('Upload keystore signing already present in app/build.gradle');
    return;
  }
  const inject = `
def uploadStoreFile = System.getenv('MYAPP_UPLOAD_STORE_FILE')
def uploadStorePassword = System.getenv('MYAPP_UPLOAD_STORE_PASSWORD')
def uploadKeyAlias = System.getenv('MYAPP_UPLOAD_KEY_ALIAS')
def uploadKeyPassword = System.getenv('MYAPP_UPLOAD_KEY_PASSWORD')
def uploadStore = uploadStoreFile ? file(uploadStoreFile) : null
def hasUploadKeystore = uploadStore?.exists() && uploadStorePassword && uploadKeyAlias && uploadKeyPassword
`;
  text = text.replace(/\ndef jscFlavor = /, `${inject}\ndef jscFlavor = `);
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
    console.warn('Could not locate buildTypes; release may use debug signing.');
    fs.writeFileSync(appGradle, text);
    return;
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
      '                throw new GradleException("Release signing requires MYAPP_UPLOAD_* env vars.")',
      '            }',
    ].join('\n')}`,
  );
  text = text.slice(0, buildTypesStart) + signedBuildTypesBlock + text.slice(packagingOptionsStart);
  fs.writeFileSync(appGradle, text);
  console.log('Patched app/build.gradle → St. Luke’s upload keystore');
}

console.log('JAVA_HOME =', javaHome);
console.log('Package = in.stlukestura.school');
console.log('Version =', appVersion, 'versionCode', versionCode);
console.log('Architectures =', arches);
console.log("Building St. Luke's School APK + AAB (college app untouched)…");

const prebuildArgs = ['expo', 'prebuild', '--platform', 'android'];
if (!skipClean) prebuildArgs.push('--clean');
run('npx', prebuildArgs);
patchGradleProperties();
patchAndroidSdkGradleFiles();
assertTargetSdk36();
ensureProguardRules();
shrinkSplashLogos();
stripFirebaseMessagingIfNeeded();
ensureUploadSigningInGradle();

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
    'bundleRelease',
    '--no-daemon',
    '--max-workers=1',
    `-PreactNativeArchitectures=${arches}`,
  ],
  { cwd: path.join(root, 'android') },
);

verifyReleaseManifest();

const apkDir = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release');
const apks = fs.existsSync(apkDir) ? fs.readdirSync(apkDir).filter((f) => f.endsWith('.apk')) : [];
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
const base = `StLukes-School-v${appVersion}-vc${versionCode}`;

function copyOut(src, name) {
  const dest = path.join(distDir, name);
  fs.copyFileSync(src, dest);
  const desktop = path.join(os.homedir(), 'Desktop', name);
  try {
    fs.copyFileSync(src, desktop);
    console.log('Desktop:', desktop);
  } catch (err) {
    console.log('Could not copy to Desktop:', err.message);
  }
  console.log('Copy:', dest);
}

console.log('\n=== St. Luke school Android release complete ===');
if (apks.length) {
  const src = path.join(apkDir, apks[0]);
  console.log('APK:', src);
  copyOut(src, `${base}.apk`);
} else {
  console.log('Look under:', apkDir);
}
if (fs.existsSync(aabPath)) {
  console.log('AAB:', aabPath);
  copyOut(aabPath, `${base}.aab`);
  copyMappingFile(distDir, base);
} else {
  console.log('Expected AAB missing at', aabPath);
  process.exit(1);
}
console.log('Android package: in.stlukestura.school');
console.log('Play Console: upload the .aab. Install the .apk on devices.');
console.log('iOS: skip for now (npm run build:prod:ios later).');
console.log('Backup upload key: apps/school-mobile/credentials/ (not in git).');
