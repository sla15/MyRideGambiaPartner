import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dropoffgambia.partner',
  appName: 'DROPOFF Partner',
  webDir: 'dist',
  plugins: {
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: "none" as any,
    },
  },
};

export default config;
