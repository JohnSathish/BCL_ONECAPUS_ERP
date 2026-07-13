/**
 * Ensures Android R8 resource-shrink keep.xml survives `expo prebuild --clean`.
 * Metro assets are string-referenced; without this, shrinkResources strips them.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KEEP_XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Prevent AGP resource shrinking from stripping Metro/Expo assets.
  RN loads drawables/raw by string name, so shrinkResources cannot see usage.
  Required in this monorepo when android.enableShrinkResourcesInReleaseBuilds=true.
-->
<resources xmlns:tools="http://schemas.android.com/tools"
    tools:keep="@raw/*,@drawable/*,@mipmap/*" />
`;

function withAndroidR8Keep(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, 'keep.xml'), KEEP_XML, 'utf8');
      return cfg;
    },
  ]);
}

module.exports = withAndroidR8Keep;
