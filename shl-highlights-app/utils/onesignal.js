// OneSignal wrapper for native platforms
// This file is only imported on native platforms via metro's platform resolution

let OneSignal = null;

try {
    OneSignal = require('react-native-onesignal').OneSignal;
} catch (e) {
    console.warn('[OneSignal] Module not available');
}

export { OneSignal };
