// Example environment configuration file
// Copy this file to environment.ts and environment.prod.ts and add your actual API keys

export const environment = {
  production: false, // Set to true in environment.prod.ts
  
  // WooCommerce API configuration
  apiUrl: 'https://your-woocommerce-site.com/wp-json/wc/v3',
  consumerKey: 'your_woocommerce_consumer_key',
  consumerSecret: 'your_woocommerce_consumer_secret',
  
  // Moyasar payment gateway (https://moyasar.com)
  moyasarPublishableKey: 'your_moyasar_publishable_key',
  
  // Taqnyat SMS service for OTP (https://taqnyat.sa)
  taqnyatApiKey: 'your_taqnyat_api_key',
  
  // OneSignal push notifications (https://onesignal.com)
  oneSignalAppId: 'your_onesignal_app_id'
};

// NOTE: For security, never commit your actual API keys to a public repository
// Use environment variables or a secure configuration management system in production