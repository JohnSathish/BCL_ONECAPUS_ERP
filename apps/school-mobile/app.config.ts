import fs from 'fs';
import path from 'path';
import type { ExpoConfig, ConfigContext } from 'expo/config';

const isNativeRelease =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'preview' ||
  process.env.LOCAL_NATIVE_RELEASE === '1';

const googleServicesLocal = './google-services.json';
const hasGoogleServices = fs.existsSync(path.join(__dirname, googleServicesLocal));
const googleServiceInfoLocal =
  process.env.GOOGLE_SERVICES_INFO_PLIST || './GoogleService-Info.plist';
const hasGoogleServiceInfo = fs.existsSync(path.join(__dirname, googleServiceInfoLocal));

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? "St. Luke's School",
  slug: 'st-lukes-school',
  version: '1.0.17',
  scheme: 'stlukesschool',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/crest.png',
    resizeMode: 'contain',
    backgroundColor: '#0b2db8',
  },
  androidStatusBar: {
    backgroundColor: '#ffffff',
    barStyle: 'dark-content',
  },
  androidNavigationBar: {
    backgroundColor: '#ffffff',
    barStyle: 'dark-content',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'in.stlukestura.school',
    buildNumber: '20',
    ...(hasGoogleServiceInfo ? { googleServicesFile: googleServiceInfoLocal } : {}),
    infoPlist: {
      NSFaceIDUsageDescription:
        "St. Luke's School uses Face ID only to unlock your signed-in school account on this device. Face data stays on your phone.",
      NSPhotoLibraryUsageDescription:
        "St. Luke's School uses your photo library only if you choose to share a gallery image. Photos are not uploaded without your action.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'in.stlukestura.school',
    versionCode: 20,
    allowBackup: false,
    ...(hasGoogleServices ? { googleServicesFile: googleServicesLocal } : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    permissions: [
      'INTERNET',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'POST_NOTIFICATIONS',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/crest.png',
        backgroundColor: '#0b2db8',
        imageWidth: 180,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#1a237e',
        defaultChannel: 'stlukes_school_default',
      },
    ],
    'expo-asset',
    'expo-router',
    'expo-system-ui',
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          "St. Luke's School uses Face ID only to unlock your signed-in school account on this device.",
      },
    ],
    'expo-font',
    './plugins/with-android-target-sdk-36',
  ],
  experiments: { typedRoutes: true },
  extra: {
    appDisplayName: process.env.EXPO_PUBLIC_APP_NAME ?? "St. Luke's School",
    privacyPolicyUrl:
      process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://stlukestura.in/privacy-policy',
    termsUrl:
      process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://basecodelabs.com/terms-and-conditions.html',
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'admin@stlukestura.in',
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ||
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
        '82f45116-2b82-4b43-93d3-7d7d2027b2da',
    },
  },
  ...(isNativeRelease ? {} : {}),
});
