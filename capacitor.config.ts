import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.drzn.sa',
  appName: 'درزن',
  webDir: 'www',
  // For production builds, comment out the server section
  // to ensure the app uses bundled files instead of remote resources
  /* 
  server: {
    androidScheme: 'https',
    cleartext: true,
    hostname: 'app.drzn.sa',
    allowNavigation: [
      'app.drzn.sa',
      '*.drzn.sa',
      'drzn.sa',
      'localhost',
      '*.replit.dev',
      '*.replit.app',
      'https://*.replit.dev',
      'https://*.replit.app',
      'https://*.drzn.sa',
      'https://app.drzn.sa'
    ]
  },
  */
  
  // Server configuration for API calls and external resources
  server: {
    androidScheme: 'https',
    cleartext: true,
    // Allow navigation to these domains for API calls and resources
    allowNavigation: [
      'app.drzn.sa',
      '*.drzn.sa',
      'drzn.sa',
      'api.drzn.sa',
      // Allow replit domains for testing
      '*.replit.dev',
      '*.replit.app',
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#ec1c24",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    StatusBar: {
      style: "LIGHT", // or DARK
      backgroundColor: "#ec1c24", // Red color matching the app theme
      overlaysWebView: false
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: "#ffffff",
    useLegacyBridge: true,
    // Improved network configuration for API connectivity
    initialFocus: true,
    // Custom configurations (moved to custom field below)
    overrideUserAgent: "DRZN-App Android/1.0.0"
  },
  cordova: {},
  // Explicitly set to allow HTTP requests on Android 9+
  loggingBehavior: "debug"
};

export default config;