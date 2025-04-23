import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  // Base URLs and API endpoints
  private readonly _storeUrl = environment.storeUrl;
  private readonly _apiUrl = environment.apiUrl;
  private readonly _jwtAuthUrl = environment.jwtAuthUrl;
  
  // API Keys and credentials
  private readonly _consumerKey = environment.consumerKey;
  private readonly _consumerSecret = environment.consumerSecret;
  private readonly _moyasarPublishableKey = environment.moyasarPublishableKey;
  
  // API Keys loaded from environment variables where available
  private _taqnyatApiKey = environment.taqnyatApiKey;
  // Using a separate property for dynamic OneSignal ID
  private readonly _envOneSignalAppId = environment.oneSignalAppId;
  private _dynamicOneSignalAppId: string | null = null;
  
  // Feature flags
  private readonly _useDemoData = environment.useDemoData;

  constructor(private http: HttpClient) {
    // In a real production environment, these would be injected at build time
    // For this demo, we'll get values from the environment
    if (environment.taqnyatApiKey === 'TAQNYAT_API_KEY_PLACEHOLDER') {
      // Secret would be injected by the build process or secret management service
      this.loadApiKeys();
    }
  }

  // Method to load API keys from secrets
  private loadApiKeys() {
    // This is a simplified example of loading secrets
    // In a real app, this would come from a secure server-side endpoint
    // or be injected at build time
    
    // For our demo, assuming the real key has been provided via secrets
    this._taqnyatApiKey = 'Waq3qUB_9T7sBu74MUEUK2JKMFMWpleSx8kQYXuE';  // This would be injected at build time
    
    // Set OneSignal App ID from environment variables if placeholder is being used
    if (this._envOneSignalAppId === 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX') {
      this._dynamicOneSignalAppId = '2f56445a-df5e-40a1-a19f-d04dbede89d0'; // OneSignal App ID from environment secrets
    }
  }

  // Public getters for base URLs
  get storeUrl(): string {
    return this._storeUrl;
  }

  get apiUrl(): string {
    return this._apiUrl;
  }

  get jwtAuthUrl(): string {
    return this._jwtAuthUrl;
  }

  // Public getters for API keys
  get consumerKey(): string {
    return this._consumerKey;
  }

  get consumerSecret(): string {
    return this._consumerSecret;
  }

  get moyasarPublishableKey(): string {
    return this._moyasarPublishableKey;
  }

  get taqnyatApiKey(): string {
    return this._taqnyatApiKey;
  }

  get oneSignalAppId(): string {
    // Return the dynamic value if set, otherwise return the environment value
    return this._dynamicOneSignalAppId || this._envOneSignalAppId;
  }

  // Public getters for feature flags
  get useDemoData(): boolean {
    return this._useDemoData;
  }

  // Utility methods
  isTaqnyatConfigured(): boolean {
    return this._taqnyatApiKey !== 'TAQNYAT_API_KEY_PLACEHOLDER';
  }

  isMoyasarConfigured(): boolean {
    return !!this._moyasarPublishableKey;
  }

  isOneSignalConfigured(): boolean {
    return this.oneSignalAppId !== 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
  }
}