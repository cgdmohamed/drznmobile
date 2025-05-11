import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  // Loaded from environment.ts
  private _taqnyatApiKey: string;
  private _oneSignalAppId: string;
  
  constructor(private platform: Platform) {
    // Initialize from environment.ts
    this.loadEnvironmentVariables();
  }
  
  /**
   * Load environment variables from environment.ts
   */
  private loadEnvironmentVariables() {
    // We don't need the Taqnyat API key anymore as the WordPress plugin handles this
    // The WordPress plugin handles all Taqnyat interactions on the server side
    this._taqnyatApiKey = 'wordpress-proxy-enabled';
    
    // Load OneSignal App ID
    this._oneSignalAppId = environment.oneSignalAppId || '';
  }
  
  /**
   * Get the Taqnyat API key
   */
  get taqnyatApiKey(): string {
    return this._taqnyatApiKey;
  }
  
  /**
   * Get the OneSignal App ID
   */
  get oneSignalAppId(): string {
    return this._oneSignalAppId;
  }
  
  /**
   * Get the base URL for API requests based on platform
   * This handles the difference in URL construction between web and mobile
   */
  getBaseUrl(): string {
    const isMobile = this.platform.is('capacitor') || this.platform.is('cordova');
    
    // If on mobile, we need to use the full URL
    if (isMobile) {
      return `https://${environment.storeUrl}`;
    }
    
    // For web development, we can use a relative URL (Angular will proxy it)
    return '';
  }
  
  /**
   * Check if Taqnyat API is configured (has a valid API key)
   */
  isTaqnyatConfigured(): boolean {
    return !!this._taqnyatApiKey && 
           this._taqnyatApiKey !== 'TAQNYAT_API_KEY_PLACEHOLDER' && 
           this._taqnyatApiKey.length > 10;
  }
  
  /**
   * Check if OneSignal is configured (has a valid App ID)
   */
  isOneSignalConfigured(): boolean {
    return !!this._oneSignalAppId && 
           this._oneSignalAppId !== 'ONESIGNAL_APP_ID_PLACEHOLDER' &&
           this._oneSignalAppId.length > 10;
  }
}