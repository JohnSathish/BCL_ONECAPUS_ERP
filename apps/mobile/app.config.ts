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
 * iOS Firebase config. Drop GoogleService-Info.plist at apps/mobile/ (from the
 * Firebase iOS app) to enable it. Wired conditionally so Android-only builds and
 * checkouts without the file never break. NOTE: FCM push tokens on iOS also need
 * the react-native-firebase messaging SDK (or a direct APNs sender on the API).
 */
const googleServiceInfoLocal = './GoogleService-Info.plist';
const hasGoogleServiceInfo = fs.existsSync(path.join(__dirname, googleServiceInfoLocal));

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
    buildNumber: '1',
    ...(hasGoogleServiceInfo ? { googleServicesFile: googleServiceInfoLocal } : {}),
    infoPlist: {
      // Required so App Store review accepts the biometric (Face ID) unlock flow.
      NSFaceIDUsageDescription: 'Use Face ID to quickly and securely sign in to the campus app.',
    },
  },
  android: {
    package: 'edu.onecampus.mobile',
    versionCode: 20,
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
    './plugins/with-android-r8-keep',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
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
