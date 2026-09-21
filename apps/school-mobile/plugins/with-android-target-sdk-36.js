const {
  withAndroidManifest,
  withAndroidStyles,
  withAppBuildGradle,
  withGradleProperties,
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
  'android:windowOptOutEdgeToEdgeEnforcement',
  'android:windowTranslucentStatus',
  'android:windowTranslucentNavigation',
  'android:fitsSystemWindows',
]);

/** Play Console: target API 36+, edge-to-edge, large screens, R8. */
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
    return cfg;
  });
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = forceSdk36(cfg.modResults.contents);
    }
    return cfg;
  });
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = forceSdk36(cfg.modResults.contents);
    }
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
    const activities = application?.activity || [];
    for (const activity of activities) {
      const name = String(activity.$?.['android:name'] || '');
      if (name.endsWith('MainActivity') || name === '.MainActivity') {
        activity.$['android:enableOnBackInvokedCallback'] = 'false';
        activity.$['android:resizeableActivity'] = 'true';
        // Play large-screen guidance: do not lock orientation / block resize.
        delete activity.$['android:screenOrientation'];
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
  return config;
};
