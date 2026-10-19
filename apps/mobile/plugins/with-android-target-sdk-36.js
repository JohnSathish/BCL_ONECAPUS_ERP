const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAndroidStyles,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withMainActivity,
  withProjectBuildGradle,
} = require('expo/config-plugins');

function upsertGradleProperty(modResults, key, value) {
  const next = modResults.filter((item) => !(item.type === 'property' && item.key === key));
  next.push({ type: 'property', key, value: String(value) });
  return next;
}

function forceSdk36(contents) {
  return contents
    .replace(
      /findProperty\('android\.compileSdkVersion'\)\s*\?: \s*'\d+'/g,
      "findProperty('android.compileSdkVersion') ?: '36'",
    )
    .replace(
      /findProperty\('android\.targetSdkVersion'\)\s*\?: \s*'\d+'/g,
      "findProperty('android.targetSdkVersion') ?: '36'",
    )
    .replace(
      /findProperty\('android\.buildToolsVersion'\)\s*\?: \s*'[\d.]+'/g,
      "findProperty('android.buildToolsVersion') ?: '36.0.0'",
    )
    .replace(/compileSdkVersion\s*=\s*\d+/g, 'compileSdkVersion = 36')
    .replace(/targetSdkVersion\s*=\s*\d+/g, 'targetSdkVersion = 36')
    .replace(/compileSdk(?:Version)?\s+\d+/g, (m) => m.replace(/\d+$/, '36'))
    .replace(/targetSdk(?:Version)?\s+\d+/g, (m) => m.replace(/\d+$/, '36'));
}

const DEPRECATED_EDGE_ITEMS = new Set([
  'android:statusBarColor',
  'android:navigationBarColor',
  'android:enforceNavigationBarContrast',
  'android:enforceStatusBarContrast',
  'enforceNavigationBarContrast',
  'enforceStatusBarContrast',
  'android:windowOptOutEdgeToEdgeEnforcement',
  'android:windowTranslucentStatus',
  'android:windowTranslucentNavigation',
  'android:fitsSystemWindows',
  'android:windowLayoutInDisplayCutoutMode',
]);

const MLKIT_SCANNER_ACTIVITY =
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

/**
 * react-native-edge-to-edge still assigns Window status/navigation bar colors.
 * Play Console flags those calls. Rewrite the module on every prebuild so the
 * packaged library uses WindowCompat + insets only. React Native's own
 * StatusBarModule still contains setStatusBarColor; that limit is documented
 * in PLAY_RELEASE.md and is not hidden.
 */
function patchEdgeToEdgeLibrary(projectRoot) {
  const pkgRoot = path.join(projectRoot, 'node_modules', 'react-native-edge-to-edge');
  const kotlinPath = path.join(
    pkgRoot,
    'android',
    'src',
    'main',
    'java',
    'com',
    'zoontek',
    'rnedgetoedge',
    'EdgeToEdgeModuleImpl.kt',
  );
  if (!fs.existsSync(kotlinPath)) return;
  let kotlin = fs.readFileSync(kotlinPath, 'utf8');
  const start = kotlin.indexOf('fun applyEdgeToEdge(');
  const end = kotlin.indexOf('fun setStatusBarStyle(');
  if (start === -1 || end === -1) {
    throw new Error(
      'react-native-edge-to-edge applyEdgeToEdge() layout changed; update the patch.',
    );
  }
  const replacement = `fun applyEdgeToEdge(reactContext: ReactApplicationContext?) {
    val activity = reactContext?.currentActivity
      ?: return FLog.w(ReactConstants.TAG, "$NAME: Ignored, current activity is null.")

    activity.runOnUiThread {
      val window = activity.window
      initInsetsController(window)
      WindowCompat.setDecorFitsSystemWindows(window, false)
      if (VERSION.SDK_INT >= VERSION_CODES.R) {
        window.attributes.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      }
    }
  }

  `;
  kotlin = kotlin.slice(0, start) + replacement + kotlin.slice(end);
  fs.writeFileSync(kotlinPath, kotlin);
  const resRoot = path.join(pkgRoot, 'android', 'src', 'main', 'res');
  if (!fs.existsSync(resRoot)) return;
  for (const dir of fs.readdirSync(resRoot)) {
    const stylesPath = path.join(resRoot, dir, 'styles.xml');
    if (!fs.existsSync(stylesPath)) continue;
    const xml = fs.readFileSync(stylesPath, 'utf8');
    const next = xml
      .split('\n')
      .filter(
        (line) =>
          !/statusBarColor|navigationBarColor|windowLayoutInDisplayCutoutMode|enforceNavigationBarContrast|enforceStatusBarContrast/.test(
            line,
          ),
      )
      .join('\n');
    fs.writeFileSync(stylesPath, next);
  }
}

/** Play Console: target API 36+, edge-to-edge, large screens, R8 (college OneCampus). */
module.exports = function withAndroidTargetSdk36(config) {
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = upsertGradleProperty(cfg.modResults, 'android.compileSdkVersion', 36);
    cfg.modResults = upsertGradleProperty(cfg.modResults, 'android.targetSdkVersion', 36);
    cfg.modResults = upsertGradleProperty(cfg.modResults, 'android.buildToolsVersion', '36.0.0');
    cfg.modResults = upsertGradleProperty(
      cfg.modResults,
      'android.enableProguardInReleaseBuilds',
      'true',
    );
    cfg.modResults = upsertGradleProperty(
      cfg.modResults,
      'android.enableShrinkResourcesInReleaseBuilds',
      'true',
    );
    cfg.modResults = upsertGradleProperty(
      cfg.modResults,
      'android.enablePngCrunchInReleaseBuilds',
      'true',
    );
    cfg.modResults = upsertGradleProperty(cfg.modResults, 'expo.edgeToEdgeEnabled', 'true');
    cfg.modResults = upsertGradleProperty(cfg.modResults, 'android.enableR8.fullMode', 'true');
    return cfg;
  });
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = forceSdk36(cfg.modResults.contents);
    }
    return cfg;
  });
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = forceSdk36(cfg.modResults.contents);
    if (!contents.includes('androidx.activity:activity')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        "dependencies {\n    implementation 'androidx.activity:activity-ktx:1.10.1'",
      );
    }
    if (
      contents.includes('proguard-android.txt') &&
      !contents.includes('proguard-android-optimize.txt')
    ) {
      contents = contents.replace('proguard-android.txt', 'proguard-android-optimize.txt');
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('androidx.activity.enableEdgeToEdge')) {
      src = src.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport androidx.activity.enableEdgeToEdge',
      );
    }
    if (!src.includes('enableEdgeToEdge()')) {
      src = src.replace(
        /override fun onCreate\(savedInstanceState: Bundle\?\) \{\r?\n/,
        'override fun onCreate(savedInstanceState: Bundle?) {\n    enableEdgeToEdge()\n',
      );
    }
    if (!src.includes('enableEdgeToEdge()')) {
      throw new Error('Could not inject enableEdgeToEdge() into MainActivity.');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
  config = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (application?.$) {
      application.$['android:allowBackup'] = 'false';
      application.$['android:fullBackupOnly'] = 'false';
      application.$['android:enableOnBackInvokedCallback'] = 'false';
      application.$['android:resizeableActivity'] = 'true';
    }
    cfg.modResults.manifest.$ = cfg.modResults.manifest.$ || {};
    cfg.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const activities = application?.activity || [];
    for (const activity of activities) {
      if (!activity.$) continue;
      delete activity.$['android:screenOrientation'];
      delete activity.$['android:maxAspectRatio'];
      activity.$['android:resizeableActivity'] = 'true';
      const name = String(activity.$['android:name'] || '');
      if (name.endsWith('MainActivity') || name === '.MainActivity') {
        activity.$['android:enableOnBackInvokedCallback'] = 'false';
        const changes = String(activity.$['android:configChanges'] || '');
        const needed = [
          'keyboard',
          'keyboardHidden',
          'orientation',
          'screenSize',
          'screenLayout',
          'uiMode',
          'smallestScreenSize',
        ];
        const set = new Set(
          changes
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean),
        );
        for (const key of needed) set.add(key);
        activity.$['android:configChanges'] = [...set].join('|');
      }
    }
    if (application && !activities.some((a) => a.$?.['android:name'] === MLKIT_SCANNER_ACTIVITY)) {
      activities.push({
        $: {
          'android:name': MLKIT_SCANNER_ACTIVITY,
          'android:exported': 'false',
          'android:resizeableActivity': 'true',
          'tools:remove': 'android:screenOrientation',
        },
      });
      application.activity = activities;
    }
    return cfg;
  });
  config = withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources.style || [];
    for (const style of styles) {
      const name = style.$?.name;
      if (name !== 'AppTheme' && name !== 'Theme.App.SplashScreen') continue;
      const items = Array.isArray(style.item) ? style.item : [];
      style.item = items.filter((item) => !DEPRECATED_EDGE_ITEMS.has(item.$?.name));
    }
    cfg.modResults.resources.style = styles;
    return cfg;
  });
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      patchEdgeToEdgeLibrary(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
  return config;
};
