export const environment = {
  production: true,
  storeUrl: 'app.drzn.sa',
  // WordPress URL for API endpoints
  wordpressUrl: 'https://app.drzn.sa',
  // WooCommerce API - For mobile devices, we'll construct the full URL in the services
  apiUrl: "/wp-json/wc/v3", // Service will construct full URL when needed
  consumerKey: "ck_6255526889b609ea53066560b71fdc41da7b866f",
  consumerSecret: "cs_bf2088d5f696a0b9f364d6090c48e9b4343c11a3",
  // Payment gateway
  moyasarPublishableKey: "pk_test_RU3BN2JEMDqyMGS6HcEiKcCw2bGhgR9tQnU6ihmY",
  // Taqnyat SMS service
  taqnyatApiKey: '',  // Will be set from EnvironmentService
  // OneSignal push notifications
  oneSignalAppId: "2a550f67-58af-4101-a500-28a97612f69c",
  // JWT Authentication - will be constructed based on platform
  jwtAuthUrl: "/wp-json/jwt-auth/v1/token", // Service will construct full URL when needed
  authCode: "Wt9-Y+a5WPDJ7f+Uz{iKlOCs)S.J6oqMP/4M*KzJFr!NpIto5@3)hBZ9=*7#X.J", // Used for Simple JWT Login plugin
  
  // Demo mode settings (set to false to use real API data)
  useDemoData: false,
  useDemoPayments: true,
  allowDemoCheckout: true
};

// IMPORTANT: Replace the placeholder values above with your actual API keys before building for production
// See environment.example.ts for more information
