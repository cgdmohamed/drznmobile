// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  
  // WooCommerce API configuration
  apiUrl: 'https://app.drzn.sa/wp-json/wc/v3',
  consumerKey: 'your_woocommerce_consumer_key',
  consumerSecret: 'your_woocommerce_consumer_secret',
  
  // Moyasar payment gateway
  moyasarPublishableKey: 'your_moyasar_publishable_key',
  
  // Taqnyat SMS service for OTP
  taqnyatApiKey: 'your_taqnyat_api_key',
  
  // OneSignal push notifications
  oneSignalAppId: 'your_onesignal_app_id'
};

// IMPORTANT: Replace the placeholder values above with your actual API keys
// See environment.example.ts for more information

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.