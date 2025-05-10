import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Platform } from '@ionic/angular';
import { environment } from '../../environments/environment';

/**
 * A helper service that handles URL construction for API requests
 * This ensures consistent behavior across web (development) and mobile (production)
 */
@Injectable({
  providedIn: 'root'
})
export class HttpHelperService {
  // Platform detection
  private isMobile: boolean;
  private isProduction = environment.production;
  
  // Base URLs
  private baseWoocommerceUrl: string;
  private baseJwtUrl: string;
  
  constructor(
    private http: HttpClient,
    private platform: Platform
  ) {
    // Detect if we're on a mobile device (Capacitor/Cordova)
    this.isMobile = this.platform.is('hybrid') || 
                    this.platform.is('capacitor') || 
                    this.platform.is('cordova');
                    
    console.log(`HttpHelperService initialized. Mobile: ${this.isMobile}, Production: ${this.isProduction}`);
    
    // Set base URLs
    if (this.isMobile || this.isProduction) {
      // Use absolute URLs for mobile/production
      this.baseWoocommerceUrl = `https://${environment.storeUrl}/wp-json/wc/v3`;
      this.baseJwtUrl = `https://${environment.storeUrl}/wp-json/simple-jwt-login/v1`;
      console.log('HttpHelper: Using absolute URLs for mobile/production');
    } else {
      // Use relative URLs for web development (proxied)
      this.baseWoocommerceUrl = environment.apiUrl;
      this.baseJwtUrl = '/wp-json/simple-jwt-login/v1';
      console.log('HttpHelper: Using relative URLs for web development');
    }
  }
  
  /**
   * Get the WooCommerce API URL
   */
  getWooCommerceUrl(endpoint: string = ''): string {
    endpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return `${this.baseWoocommerceUrl}/${endpoint}`;
  }
  
  /**
   * Get the JWT API URL
   */
  getJwtUrl(endpoint: string = ''): string {
    endpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return `${this.baseJwtUrl}/${endpoint}`;
  }
  
  /**
   * Create params with WooCommerce authentication
   */
  createWooCommerceParams(additionalParams: Record<string, any> = {}): HttpParams {
    let params = new HttpParams()
      .set('consumer_key', environment.consumerKey)
      .set('consumer_secret', environment.consumerSecret);
      
    // Add additional params
    Object.keys(additionalParams).forEach(key => {
      params = params.set(key, additionalParams[key]);
    });
    
    return params;
  }
  
  /**
   * Make a GET request to the WooCommerce API
   */
  getFromWooCommerce<T>(endpoint: string, params: Record<string, any> = {}): Observable<T> {
    const url = this.getWooCommerceUrl(endpoint);
    const httpParams = this.createWooCommerceParams(params);
    
    console.log(`Making GET request to WooCommerce endpoint: ${url}`);
    return this.http.get<T>(url, { params: httpParams });
  }
  
  /**
   * Make a POST request to the WooCommerce API
   */
  postToWooCommerce<T>(endpoint: string, body: any, params: Record<string, any> = {}): Observable<T> {
    const url = this.getWooCommerceUrl(endpoint);
    const httpParams = this.createWooCommerceParams(params);
    
    console.log(`Making POST request to WooCommerce endpoint: ${url}`);
    return this.http.post<T>(url, body, { params: httpParams });
  }
  
  /**
   * Make a PUT request to the WooCommerce API
   */
  putToWooCommerce<T>(endpoint: string, body: any, params: Record<string, any> = {}): Observable<T> {
    const url = this.getWooCommerceUrl(endpoint);
    const httpParams = this.createWooCommerceParams(params);
    
    console.log(`Making PUT request to WooCommerce endpoint: ${url}`);
    return this.http.put<T>(url, body, { params: httpParams });
  }
  
  /**
   * Make a DELETE request to the WooCommerce API
   */
  deleteFromWooCommerce<T>(endpoint: string, params: Record<string, any> = {}): Observable<T> {
    const url = this.getWooCommerceUrl(endpoint);
    const httpParams = this.createWooCommerceParams(params);
    
    console.log(`Making DELETE request to WooCommerce endpoint: ${url}`);
    return this.http.delete<T>(url, { params: httpParams });
  }
  
  /**
   * Make a GET request to the JWT API
   */
  getFromJwt<T>(endpoint: string): Observable<T> {
    const url = this.getJwtUrl(endpoint);
    console.log(`Making GET request to JWT endpoint: ${url}`);
    return this.http.get<T>(url);
  }
  
  /**
   * Make a POST request to the JWT API
   */
  postToJwt<T>(endpoint: string, body: any): Observable<T> {
    const url = this.getJwtUrl(endpoint);
    console.log(`Making POST request to JWT endpoint: ${url}`);
    return this.http.post<T>(url, body);
  }
}