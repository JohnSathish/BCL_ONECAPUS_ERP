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
const appIcon = isNativeReleaseBuild
  ? './assets/bcl-onecampus-logo.png'
  : './assets/splash-solid.png';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.EXPO_PUBLIC_APP_NAME ?? 'Don Bosco College, Tura',
  slug: 'onecampus-mobile',
  version: '1.0.20',
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
    // Rejected build was 1.0.19 (2) — bump for App Review resubmit.
    buildNumber: '3',
    ...(hasGoogleServiceInfo && googleServiceInfoFile
      ? { googleServicesFile: googleServiceInfoFile }
      : {}),
    infoPlist: {
      // Explicit purpose strings (Guideline 2.5.1 / 5.1.1) — must say why + how data is used.
      NSFaceIDUsageDescription:
        'Don Bosco College campus app uses Face ID so enrolled students and staff can unlock the app and sign in without re-entering a password. Face data stays on your device and is never uploaded to college servers.',
      NSCameraUsageDescription:
        'Don Bosco College campus app uses the camera only to scan one-time login QR codes shown on the student or staff web portal. The app does not take photographs or record video.',
      NSPhotoLibraryUsageDescription:
        'Don Bosco College campus app needs access to your photo library so students and staff can choose an existing passport-style photo to upload for profile or admission documentation. Selected photos are uploaded to your college account for verification and are not shared with other users.',
      // Standard HTTPS / OS crypto only — no custom non-exempt encryption.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'edu.onecampus.mobile',
    versionCode: 40,
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
        // Library-only: profile/passport upload uses launchImageLibraryAsync (no in-app camera capture).
        photosPermission:
          'Don Bosco College campus app needs access to your photo library so students and staff can choose an existing passport-style photo to upload for profile or admission documentation. Selected photos are uploaded to your college account for verification and are not shared with other users.',
        cameraPermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Don Bosco College campus app uses the camera only to scan one-time login QR codes shown on the student or staff web portal. The app does not take photographs or record video.',
        microphonePermission: false,
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
