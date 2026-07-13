/**
 * Local native Android release APK (no EAS).
 * Usage from apps/mobile: npm run build:apk
 *
 * Builds arm64-v8a only by default to avoid Windows NDK OOM
 * ("paging file is too small") when compiling many ABIs at once.
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

const arches = process.env.REACT_NATIVE_ARCHITECTURES || 'arm64-v8a';
const skipClean = process.env.SKIP_PREBUILD_CLEAN === '1';

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
  LOCAL_NATIVE_RELEASE: '1',
  EAS_BUILD_PROFILE: process.env.EAS_BUILD_PROFILE || 'production-apk',
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://erp.donboscocollege.ac.in/api',
  EXPO_PUBLIC_TENANT_SLUG: process.env.EXPO_PUBLIC_TENANT_SLUG || 'demo',
  EXPO_PUBLIC_APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Don Bosco College, Tura',
  ORG_GRADLE_PROJECT_reactNativeArchitectures: arches,
  // Local smoke APKs may use debug signing; never upload those to Play.
  ORG_GRADLE_PROJECT_ALLOW_DEBUG_RELEASE_SIGNING: 'true',
};

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
console.log('Architectures =', arches);
console.log('Building native release APK (no EAS)…');

const prebuildArgs = ['expo', 'prebuild', '--platform', 'android'];
if (!skipClean) prebuildArgs.push('--clean');
run('npx', prebuildArgs);
patchGradleProperties();

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

console.log('\n=== Build complete ===');
if (apks.length) {
  for (const f of apks) {
    const src = path.join(apkDir, f);
    const destName = `DonBoscoCollege-Tura-v1.0.0-${arches.replace(/,/g, '-')}.apk`;
    const dest = path.join(distDir, destName);
    fs.copyFileSync(src, dest);
    console.log('APK:', src);
    console.log('Copy:', dest);
  }
} else {
  console.log('Look under:', apkDir);
}
