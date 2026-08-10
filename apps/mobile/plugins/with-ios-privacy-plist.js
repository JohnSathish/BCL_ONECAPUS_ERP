/**
 * Forces required iOS privacy purpose strings into Info.plist after other plugins.
 * Registered early in the plugins list so the infoPlist mod runs last (innermost)
 * and cannot be stripped by expo-image-picker `cameraPermission: false` (ITMS-90683).
 */
const { withInfoPlist } = require('@expo/config-plugins');

const CAMERA =
  'Don Bosco College campus app uses the camera only to scan one-time login QR codes shown on the student or staff web portal. The app does not take photographs or record video.';
const PHOTOS =
  'Don Bosco College campus app needs access to your photo library so students and staff can choose an existing passport-style photo to upload for profile or admission documentation. Selected photos are uploaded to your college account for verification and are not shared with other users.';
const FACE_ID =
  'Don Bosco College campus app uses Face ID so enrolled students and staff can unlock the app and sign in without re-entering a password. Face data stays on your device and is never uploaded to college servers.';

function withIosPrivacyPlist(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSCameraUsageDescription = CAMERA;
    cfg.modResults.NSPhotoLibraryUsageDescription = PHOTOS;
    cfg.modResults.NSFaceIDUsageDescription = FACE_ID;
    cfg.modResults.ITSAppUsesNonExemptEncryption = false;
    // QR login does not record audio — drop any default mic string plugins may re-add.
    delete cfg.modResults.NSMicrophoneUsageDescription;
    return cfg;
  });
}

module.exports = withIosPrivacyPlist;
