export const environment = {
  production: true,
  // Proxy URLs for security (prevents CORS issues and hides credentials)
  storeUrl: 'app.drzn.sa',
  apiUrl: '/api',  // Proxy to WooCommerce API
  consumerKey: 'ck_6255526889b609ea53066560b71fdc41da7b866f',
  consumerSecret: 'cs_bf2088d5f696a0b9f364d6090c48e9b4343c11a3',
  moyasarPublishableKey: 'pk_test_RU3BN2JEMDqyMGS6HcEiKcCw2bGhgR9tQnU6ihmY',
  taqnyatApiKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  oneSignalAppId: '2a550f67-58af-4101-a500-28a97612f69c',
  // JWT Authentication
  jwtAuthUrl: '/jwt-auth/token',  // Proxy to JWT Auth
  simpleJwtUrl: '/simple-jwt',   // Proxy to Simple JWT Login
  authCode: 'Wt9-Y+a5WPDJ7f+Uz{iKlOCs)S.J6oqMP/4M*KzJFr!NpIto5@3)hBZ9=*7#X.J', // Used for Simple JWT Login plugin
};

// IMPORTANT: Replace the placeholder values above with your actual API keys before building for production
// See environment.example.ts for more information
