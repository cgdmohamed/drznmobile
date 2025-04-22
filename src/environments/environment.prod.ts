export const environment = {
  production: true,
  
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

// IMPORTANT: Replace the placeholder values above with your actual API keys before building for production
// See environment.example.ts for more information
