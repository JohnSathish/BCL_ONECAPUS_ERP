import fs from 'fs';
import path from 'path';
import type { ExpoConfig, ConfigContext } from 'expo/config';

const isDevClientBuild = process.env.EAS_BUILD_PROFILE === 'development';
const isNativeReleaseBuild =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'preview' ||
  process.env.EAS_BUILD_PROFILE === 'production-apk' ||
  process.env.LOCAL_NATIVE_RELEASE === '1';
const easBuildProfile = process.env.EAS_BUILD_PROFILE;
/** EAS file secret path on build workers; local file for `expo run` / prebuild. */
const googleServicesFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
const googleServicesLocal = './google-services.json';
const googleServicesAbs = path.join(
  __dirname,
  googleServicesFromEnv && !path.isAbsolute(googleServicesFromEnv)
    ? googleServicesFromEnv
    : googleServicesLocal,
);
const googleServicesFile = googleServicesFromEnv
  ? googleServicesFromEnv
  : // Do not point EAS CLI at a gitignored local file — it will not be uploaded.
    // The build worker re-evaluates config with GOOGLE_SERVICES_JSON from EAS secrets.
    !easBuildProfile && fs.existsSync(googleServicesAbs)
    ? googleServicesLocal
    : googleServicesFromEnv;
const hasGoogleServices = Boolean(
  googleServicesFile &&
  (path.isAbsolute(googleServicesFile)
    ? fs.existsSync(googleServicesFile)
    : fs.existsSync(path.join(__dirname, googleServicesFile)) ||
      Boolean(easBuildProfile && googleServicesFromEnv)),
);
/** Expo Go shows the app icon while bundling — use a solid asset in dev to avoid a second logo splash. */
const appIcon = isNativeReleaseBuild
  ? './assets/bcl-onecampus-logo.png'
  : './assets/splash-solid.png';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? 'Don Bosco College, Tura',
  slug: 'onecampus-mobile',
  version: '1.0.0',
  scheme: 'onecampus',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: appIcon,
  splash: {
    image: './assets/bcl-onecampus-logo.png',
    resizeMode: 'contain',
    backgroundColor: '#020f2e',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'edu.onecampus.mobile',
  },
  android: {
    package: 'edu.onecampus.mobile',
    versionCode: 15,
    ...(hasGoogleServices && googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    permissions: [
      'INTERNET',
      'WAKE_LOCK',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'POST_NOTIFICATIONS',
      'CAMERA',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
    ],
    /** Strip permissions libraries may merge that we do not use (Play policy). */
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/bcl-onecampus-logo.png',
        backgroundColor: '#020f2e',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/bcl-onecampus-logo.png',
        color: '#1e3a8a',
        defaultChannel: 'onecampus_default',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow the campus app to access photos for passport photo upload.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Allow the campus app to scan login QR codes.',
        recordAudioAndroid: false,
      },
    ],
    'expo-document-picker',
    'expo-router',
    'expo-secure-store',
    'expo-asset',
    'expo-font',
    '@react-native-community/datetimepicker',
    ...(isDevClientBuild ? ['expo-dev-client'] : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appDisplayName: process.env.EXPO_PUBLIC_APP_NAME ?? 'Don Bosco College, Tura',
    privacyPolicyUrl:
      process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://basecodelabs.com/privacy-policy.html',
    termsUrl:
      process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://basecodelabs.com/terms-and-conditions.html',
    accountDeletionUrl:
      process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL ??
      'https://basecodelabs.com/account-deletion.html',
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'contact@basecodelabs.com',
    eas: {
      projectId: 'b617eca6-5dde-443b-aef6-737b553d54ad',
    },
  },
});
