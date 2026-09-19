const {
  withAndroidManifest,
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
    }
    return cfg;
  });
  return config;
};
