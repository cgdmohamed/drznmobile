import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  // Loaded from environment.ts
  private _taqnyatApiKey: string;
  private _oneSignalAppId: string;
  
  constructor() {
    // Initialize from environment.ts
    this.loadEnvironmentVariables();
  }
  
  /**
   * Load environment variables from environment.ts
   */
  private loadEnvironmentVariables() {
    // Load Taqnyat API key
    this._taqnyatApiKey = environment.taqnyatApiKey || '';
    
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