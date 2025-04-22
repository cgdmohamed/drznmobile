import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  // Clone of environment for runtime modifications
  private _env = { ...environment };

  constructor(private http: HttpClient) {
    this.initializeSecrets();
  }

  // Initialize API keys from secrets
  private async initializeSecrets() {
    try {
      // Attempt to get secrets from a secure storage or config endpoint
      // For this demo, we're setting them directly from the environment variables
      
      // Note: In a real production app, you would implement a secure way to fetch these
      if (typeof WC_CONSUMER_KEY !== 'undefined') {
        this._env.consumerKey = WC_CONSUMER_KEY;
      }
      
      if (typeof WC_CONSUMER_SECRET !== 'undefined') {
        this._env.consumerSecret = WC_CONSUMER_SECRET;
      }
      
      if (typeof WC_STORE_URL !== 'undefined') {
        this._env.storeUrl = WC_STORE_URL;
        this._env.apiUrl = `https://${WC_STORE_URL}/wp-json/wc/v3`;
        this._env.jwtAuthUrl = `https://${WC_STORE_URL}/wp-json/jwt-auth/v1/token`;
      }
      
      if (typeof MOYASAR_PUBLISHABLE_KEY !== 'undefined') {
        this._env.moyasarPublishableKey = MOYASAR_PUBLISHABLE_KEY;
      }
      
      console.log('Environment initialized with API credentials');
    } catch (error) {
      console.error('Failed to initialize API credentials', error);
    }
  }

  // Getter for the environment
  get env() {
    return this._env;
  }

  // Getters for specific environment values
  get apiUrl(): string {
    return this._env.apiUrl;
  }

  get consumerKey(): string {
    return this._env.consumerKey;
  }

  get consumerSecret(): string {
    return this._env.consumerSecret;
  }

  get moyasarPublishableKey(): string {
    return this._env.moyasarPublishableKey;
  }

  get storeUrl(): string {
    return this._env.storeUrl;
  }

  get jwtAuthUrl(): string {
    return this._env.jwtAuthUrl;
  }

  get useDemoData(): boolean {
    // If credentials are missing, use demo data
    return this._env.useDemoData || 
           !this._env.consumerKey || 
           !this._env.consumerSecret ||
           this._env.consumerKey === '' ||
           this._env.consumerSecret === '';
  }
}

// TypeScript definitions are in types.d.ts file