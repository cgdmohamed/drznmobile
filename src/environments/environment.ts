// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // Set your store URL here - retrieve from environment variable during build in production
  storeUrl: 'yourwoostore.com', 
  apiUrl: 'https://yourwoostore.com/wp-json/wc/v3',
  consumerKey: '', // Will be populated at runtime from the secret
  consumerSecret: '', // Will be populated at runtime from the secret
  moyasarPublishableKey: 'pk_test_RU3BN2JEMDqyMGS6HcEiKcCw2bGhgR9tQnU6ihmY',
  taqnyatApiKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  oneSignalAppId: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
  // JWT Authentication
  jwtAuthUrl: 'https://yourwoostore.com/wp-json/jwt-auth/v1/token',
  
  // Fallback to demo mode if API connection fails
  useDemoData: false
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