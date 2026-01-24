const config = require('./app.json');

// Use EAS secrets for Firebase config files if available,
// otherwise fall back to local files for development
const androidGoogleServicesFile =
  process.env.GOOGLE_SERVICES_JSON || './google-services.json';
const iosGoogleServicesFile =
  process.env.GOOGLE_SERVICE_INFO_PLIST || './GoogleService-Info.plist';

module.exports = {
  ...config,
  expo: {
    ...config.expo,
    android: {
      ...config.expo.android,
      googleServicesFile: androidGoogleServicesFile,
    },
    ios: {
      ...config.expo.ios,
      googleServicesFile: iosGoogleServicesFile,
    },
  },
};
