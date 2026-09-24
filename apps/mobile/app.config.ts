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
/**
 * FCM config resolution:
 * 1) EAS file env `GOOGLE_SERVICES_JSON` (absolute path on the build worker)
 * 2) Local `./google-services.json` (required for local AAB/APK / prebuild)
 *
 * IMPORTANT: local scripts set EAS_BUILD_PROFILE=production — do NOT skip the local
 * file in that case, or the AAB ships without Firebase and push tokens never register.
 */
const googleServicesFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
const googleServicesLocal = './google-services.json';
const googleServicesLocalAbs = path.join(__dirname, googleServicesLocal);
const googleServicesFile = googleServicesFromEnv
  ? googleServicesFromEnv
  : fs.existsSync(googleServicesLocalAbs)
    ? googleServicesLocal
    : undefined;
const hasGoogleServices = Boolean(
  googleServicesFile &&
  (path.isAbsolute(googleServicesFile)
    ? fs.existsSync(googleServicesFile)
    : fs.existsSync(path.join(__dirname, googleServicesFile))),
);

/**
 * iOS Firebase config. Prefer checked-in local file when allowed into the EAS
 * archive, or set EAS file env `GOOGLE_SERVICE_INFO_PLIST` for cloud builds.
 */
const googleServiceInfoFromEnv = process.env.GOOGLE_SERVICE_INFO_PLIST?.trim();
const googleServiceInfoLocal = './GoogleService-Info.plist';
const googleServiceInfoFile = googleServiceInfoFromEnv
  ? googleServiceInfoFromEnv
  : fs.existsSync(path.join(__dirname, googleServiceInfoLocal))
    ? googleServiceInfoLocal
    : undefined;
const hasGoogleServiceInfo = Boolean(
  googleServiceInfoFile &&
  (path.isAbsolute(googleServiceInfoFile)
    ? fs.existsSync(googleServiceInfoFile)
    : fs.existsSync(path.join(__dirname, googleServiceInfoFile))),
);

if (
  (easBuildProfile === 'production' ||
    easBuildProfile === 'preview' ||
    easBuildProfile === 'production-apk' ||
    process.env.LOCAL_NATIVE_RELEASE === '1') &&
  !hasGoogleServices
) {
  throw new Error(
    'google-services.json is required for this build (FCM). Place it at apps/mobile/google-services.json or set EAS env GOOGLE_SERVICES_JSON (file).',
  );
}
/** Expo Go shows the app icon while bundling — use a solid asset in dev to avoid a second logo splash. */
const isStLukesSis =
  process.env.EXPO_PUBLIC_TENANT_SLUG === 'st-lukes-tura' ||
  /st\.?\s*luke/i.test(process.env.EXPO_PUBLIC_APP_NAME ?? '');
const schoolIcon = './assets/school-sis/icon.png';
const appIcon = isStLukesSis
  ? schoolIcon
  : isNativeReleaseBuild
    ? './assets/icon.png'
    : './assets/splash-solid.png';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? 'Don Bosco College, Tura',
  slug: 'onecampus-mobile',
  version: '1.0.26',
  scheme: ['onecampus', 'schoolerp'],
  // Play large-screen guidance: do not lock to portrait in the manifest.
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: appIcon,
  splash: {
    image: isStLukesSis ? schoolIcon : './assets/icon.png',
    resizeMode: 'contain',
    backgroundColor: isStLukesSis ? '#0b1640' : '#261265',
  },
  // Edge-to-edge: avoid solid status/nav bar colors (deprecated on Android 15+).
  androidStatusBar: {
    barStyle: 'dark-content',
    translucent: true,
    backgroundColor: '#00000000',
  },
  androidNavigationBar: {
    barStyle: 'dark-content',
    backgroundColor: '#00000000',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'edu.onecampus.mobile',
    // Icon + branding refresh (Play 1.0.24 / App Store build after logo update).
    buildNumber: '8',
    ...(hasGoogleServiceInfo && googleServiceInfoFile
      ? { googleServicesFile: googleServiceInfoFile }
      : {}),
    infoPlist: {
      // Explicit purpose strings (Guideline 2.5.1 / 5.1.1) — must say why + how data is used.
      NSFaceIDUsageDescription:
        'Don Bosco College campus app uses Face ID so enrolled students and staff can unlock the app and sign in without re-entering a password. Face data stays on your device and is never uploaded to college servers.',
      // Required by expo-camera (QR login). Must stay present — see image-picker note below.
      NSCameraUsageDescription:
        'Don Bosco College campus app uses the camera to scan one-time login QR codes from the student or staff web portal, and for staff to scan student ID card QR codes or barcodes when marking class attendance. The app does not take photographs or record video.',
      NSPhotoLibraryUsageDescription:
        'Don Bosco College campus app needs access to your photo library so students and staff can choose an existing passport-style photo to upload for profile or admission documentation. Selected photos are uploaded to your college account for verification and are not shared with other users.',
      // Standard HTTPS / OS crypto only — no custom non-exempt encryption.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'edu.onecampus.mobile',
    versionCode: 46,
    edgeToEdgeEnabled: true,
    allowBackup: false,
    ...(hasGoogleServices && googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      foregroundImage: isStLukesSis
        ? './assets/school-sis/adaptive-icon.png'
        : './assets/adaptive-icon.png',
      backgroundColor: isStLukesSis ? '#0b1640' : '#261265',
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
    './plugins/with-android-r8-keep',
    // Register early so this infoPlist mod runs last and keeps NSCameraUsageDescription.
    './plugins/with-ios-privacy-plist',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          // Play Console R8/obfuscation/shrinking scores (survives `expo prebuild --clean`).
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules: [
            '-keepattributes SourceFile,LineNumberTable',
            '-renamesourcefileattribute SourceFile',
            '-keepattributes *Annotation*',
            '-keepattributes Signature',
            '-keepattributes Exceptions',
            '-keepattributes InnerClasses',
            '-keepattributes EnclosingMethod',
            '-keep class com.facebook.react.** { *; }',
            '-keep class com.facebook.hermes.** { *; }',
            '-keep class com.facebook.jni.** { *; }',
            '-keep class com.facebook.react.turbomodule.** { *; }',
            '-keep class com.facebook.react.bridge.** { *; }',
            '-dontwarn com.facebook.react.**',
            '-dontwarn com.facebook.hermes.**',
            '-keep class com.swmansion.reanimated.** { *; }',
            '-keep class com.swmansion.gesturehandler.** { *; }',
            '-keep class expo.modules.** { *; }',
            '-dontwarn expo.modules.**',
            '-keep class com.google.firebase.** { *; }',
            '-keep class com.google.android.gms.** { *; }',
            '-dontwarn com.google.firebase.**',
            '-dontwarn com.google.android.gms.**',
            '-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }',
            '-keepattributes JavascriptInterface',
            '-dontwarn com.razorpay.**',
            '-keep class com.razorpay.** { *; }',
            '-keepclasseswithmembers class * { public void onPayment*(...); }',
            '-optimizations !method/inlining/',
            '-dontwarn okhttp3.**',
            '-dontwarn okio.**',
            '-dontwarn javax.annotation.**',
          ].join('\n'),
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/icon.png',
        backgroundColor: '#261265',
        imageWidth: 220,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-notifications',
      {
        // Android status-bar icons must stay simple/monochrome — keep non-seal mark.
        icon: './assets/bcl-onecampus-logo.png',
        color: '#1e3a8a',
        defaultChannel: 'onecampus_default',
      },
    ],
    [
      'expo-image-picker',
      {
        // Profile/passport upload uses launchImageLibraryAsync only (no in-app capture).
        // IMPORTANT: do NOT set cameraPermission: false — that deletes NSCameraUsageDescription
        // from Info.plist after expo-camera (mod chain), which fails Apple ITMS-90683 even though
        // QR login still links camera APIs. Keep the same purpose string as expo-camera.
        photosPermission:
          'Don Bosco College campus app needs access to your photo library so students and staff can choose an existing passport-style photo to upload for profile or admission documentation. Selected photos are uploaded to your college account for verification and are not shared with other users.',
        cameraPermission:
          'Don Bosco College campus app uses the camera to scan one-time login QR codes from the student or staff web portal, and for staff to scan student ID card QR codes or barcodes when marking class attendance. The app does not take photographs or record video.',
        // Explicit false so a later image-picker mod does not re-add a default mic string.
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Don Bosco College campus app uses the camera to scan one-time login QR codes from the student or staff web portal, and for staff to scan student ID card QR codes or barcodes when marking class attendance. The app does not take photographs or record video.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    'expo-document-picker',
    'expo-router',
    'expo-secure-store',
    'expo-asset',
    'expo-font',
    'expo-system-ui',
    '@react-native-community/datetimepicker',
    [
      'react-native-edge-to-edge',
      {
        android: {
          parentTheme: 'Default',
          enforceNavigationBarContrast: false,
        },
      },
    ],
    './plugins/with-android-target-sdk-36',
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
