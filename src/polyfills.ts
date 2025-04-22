/***************************************************************************************************
 * Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
 */
// import '@angular/localize/init';

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js';  // Included with Angular CLI.

/***************************************************************************************************
 * APPLICATION IMPORTS
 */

import 'whatwg-fetch';

// Global application polyfills
(window as any).process = {
  env: { 
    NODE_ENV: 'production',
    MOYASAR_PUBLISHABLE_KEY: 'your_moyasar_publishable_key',
    ONESIGNAL_APP_ID: 'your_onesignal_app_id',
    TAQNYAT_API_KEY: 'your_taqnyat_api_key'
  }
};