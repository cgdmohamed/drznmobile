// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // Use local proxy to avoid CORS issues
  storeUrl: 'app.drzn.sa', 
  apiUrl: '/wp-json/wc/v3',
  consumerKey: 'ck_6255526889b609ea53066560b71fdc41da7b866f',
  consumerSecret: 'cs_bf2088d5f696a0b9f364d6090c48e9b4343c11a3',
  moyasarPublishableKey: 'pk_test_RU3BN2JEMDqyMGS6HcEiKcCw2bGhgR9tQnU6ihmY',
  // This will be loaded from environment variables in the service
  taqnyatApiKey: 'TAQNYAT_API_KEY_PLACEHOLDER',
  oneSignalAppId: '2a550f67-58af-4101-a500-28a97612f69c',
  // JWT Authentication
  jwtAuthUrl: '/wp-json/jwt-auth/v1/token',
  authCode: 'Wt9-Y+a5WPDJ7f+Uz{iKlOCs)S.J6oqMP/4M*KzJFr!NpIto5@3)hBZ9=*7#X.J', // Used for Simple JWT Login plugin
  
  // Demo mode settings
  useDemoData: false,      // Set to false to use real API data instead of demo data
  useDemoPayments: false,  // Set to false to use real payment gateways
  
  // Demo data settings
  allowDemoCheckout: true  // Allow checkout flow in demo mode with demonstration UI
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