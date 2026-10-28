const { withAndroidStyles, withMainActivity } = require('expo/config-plugins');

/**
 * Listed first in app.config plugins so this mod runs after the splash plugin.
 * Expo evaluates mods in reverse registration order.
 *
 * The splash theme is the window theme before AppTheme. Without windowNoTitle,
 * Android paints the activity label over the in-app menu. enableEdgeToEdge()
 * must run after SplashScreenManager so that label is not created.
 */
const NO_TITLE_ITEMS = [
  ['windowActionBar', 'false'],
  ['android:windowActionBar', 'false'],
  ['windowNoTitle', 'true'],
  ['android:windowNoTitle', 'true'],
];

function ensureImport(src, statement) {
  if (src.includes(statement)) return src;
  return src.replace(/^(package .+\r?\n)/, `$1${statement}\n`);
}

function ensureStyleItems(style) {
  const items = Array.isArray(style.item) ? style.item : [];
  style.item = items;
  for (const [name, value] of NO_TITLE_ITEMS) {
    if (!style.item.some((item) => item.$?.name === name)) {
      style.item.push({ $: { name }, _: value });
    }
  }
}

function patchMainActivity(src) {
  let next = src;
  next = ensureImport(next, 'import android.os.Build');
  next = ensureImport(next, 'import android.view.View');
  next = ensureImport(next, 'import android.view.Window');
  if (!next.includes('androidx.activity.enableEdgeToEdge')) {
    next = ensureImport(next, 'import androidx.activity.enableEdgeToEdge');
  }
  next = next.replace(/^[ \t]*enableEdgeToEdge\(\)\r?\n/gm, '');
  if (!next.includes('requestWindowFeature(Window.FEATURE_NO_TITLE)')) {
    next = next.replace(
      /override fun onCreate\(savedInstanceState: Bundle\?\) \{\r?\n/,
      `override fun onCreate(savedInstanceState: Bundle?) {\n    try {\n      requestWindowFeature(Window.FEATURE_NO_TITLE)\n    } catch (_: Exception) {\n    }\n`,
    );
  }
  if (next.includes('SplashScreenManager.registerOnActivity(this)')) {
    next = next.replace(
      'SplashScreenManager.registerOnActivity(this)',
      'SplashScreenManager.registerOnActivity(this)\n    enableEdgeToEdge()',
    );
  } else {
    next = next.replace(/super\.onCreate\(null\)/, 'enableEdgeToEdge()\n    super.onCreate(null)');
  }
  if (!next.includes('hideNativeTitleBar()')) {
    next = next.replace(
      /super\.onCreate\(null\)\r?\n/,
      'super.onCreate(null)\n    hideNativeTitleBar()\n    window.decorView.post { hideNativeTitleBar() }\n',
    );
  }
  if (!next.includes('fun hideNativeTitleBar()')) {
    next = next.replace(
      /\n  override fun getMainComponentName\(\)/,
      `
  override fun onResume() {
    super.onResume()
    hideNativeTitleBar()
  }

  private fun hideNativeTitleBar() {
    supportActionBar?.hide()
    actionBar?.hide()
    title = ""
    val decor = window.decorView
    decor.findViewById<View>(android.R.id.title)?.visibility = View.GONE
    val titleContainerId = resources.getIdentifier("title_container", "id", "android")
    if (titleContainerId != 0) {
      decor.findViewById<View>(titleContainerId)?.visibility = View.GONE
    }
    decor.requestLayout()
  }

  override fun getMainComponentName()`,
    );
  }
  return next;
}

module.exports = function withAndroidNoTitleBar(config) {
  config = withMainActivity(config, (cfg) => {
    cfg.modResults.contents = patchMainActivity(cfg.modResults.contents);
    return cfg;
  });
  config = withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources.style || [];
    for (const style of styles) {
      const name = style.$?.name;
      if (name === 'AppTheme' || name === 'Theme.App.SplashScreen') ensureStyleItems(style);
    }
    cfg.modResults.resources.style = styles;
    return cfg;
  });
  return config;
};
