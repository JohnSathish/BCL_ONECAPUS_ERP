const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force React Native resolution to the mobile workspace version.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

module.exports = config;
