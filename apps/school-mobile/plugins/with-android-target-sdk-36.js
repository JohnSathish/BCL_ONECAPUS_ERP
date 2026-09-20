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

/** Play Console requires target API 36+ for St. Luke's School AAB uploads. */
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
    }
    const activities = application?.activity || [];
    for (const activity of activities) {
      const name = String(activity.$?.['android:name'] || '');
      if (name.endsWith('MainActivity') || name === '.MainActivity') {
        activity.$['android:enableOnBackInvokedCallback'] = 'false';
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
      const keep = items.filter((item) => {
        const key = item.$?.name;
        return (
          key !== 'android:navigationBarColor' &&
          key !== 'android:windowLightNavigationBar' &&
          key !== 'android:enforceNavigationBarContrast' &&
          key !== 'android:statusBarColor'
        );
      });
      keep.push({ $: { name: 'android:navigationBarColor' }, _: '#FFFFFF' });
      keep.push({ $: { name: 'android:windowLightNavigationBar' }, _: 'true' });
      keep.push({ $: { name: 'android:enforceNavigationBarContrast' }, _: 'false' });
      if (name === 'AppTheme') {
        keep.push({ $: { name: 'android:statusBarColor' }, _: '#FFFFFF' });
      }
      style.item = keep;
    }
    cfg.modResults.resources.style = styles;
    return cfg;
  });
  return config;
};
