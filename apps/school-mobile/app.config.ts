import fs from 'fs';
import path from 'path';
import type { ExpoConfig, ConfigContext } from 'expo/config';

const isNativeRelease =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'preview' ||
  process.env.LOCAL_NATIVE_RELEASE === '1';

const googleServicesLocal = './google-services.json';
const hasGoogleServices = fs.existsSync(path.join(__dirname, googleServicesLocal));
const googleServiceInfoLocal = './GoogleService-Info.plist';
const hasGoogleServiceInfo = fs.existsSync(path.join(__dirname, googleServiceInfoLocal));

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? "St. Luke's School",
  slug: 'st-lukes-school',
  version: '1.0.0',
  scheme: 'stlukesschool',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1a237e',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'in.stlukestura.school',
    buildNumber: '1',
    ...(hasGoogleServiceInfo ? { googleServicesFile: googleServiceInfoLocal } : {}),
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "St. Luke's School uses your photo library only if you choose to share a gallery image. Photos are not uploaded without your action.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'in.stlukestura.school',
    versionCode: 1,
    ...(hasGoogleServices ? { googleServicesFile: googleServicesLocal } : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a237e',
    },
    permissions: ['INTERNET', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE', 'POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        backgroundColor: '#1a237e',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#1a237e',
        defaultChannel: 'stlukes_school_default',
      },
    ],
    'expo-router',
    'expo-secure-store',
    'expo-font',
  ],
  experiments: { typedRoutes: true },
  extra: {
    appDisplayName: process.env.EXPO_PUBLIC_APP_NAME ?? "St. Luke's School",
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '' },
  },
  ...(isNativeRelease ? {} : {}),
});
