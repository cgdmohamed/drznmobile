import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
    
    // Set base URLs - always use full URLs for mobile devices
    if (this.isMobile) {
      // Mobile devices need full URLs without wp-json prefix (server handles this)
      this.baseWoocommerceUrl = `https://${environment.storeUrl}/wp-json/wc/v3`;
      this.baseJwtUrl = `https://${environment.storeUrl}/wp-json/simple-jwt-login/v1`;
      console.log('HttpHelper: Using direct URLs for mobile:', this.baseWoocommerceUrl);
    } else if (this.isProduction) {
      // Production web builds
      this.baseWoocommerceUrl = `https://${environment.storeUrl}/${environment.apiUrl}`;
      this.baseJwtUrl = `https://${environment.storeUrl}/wp-json/simple-jwt-login/v1`;
      console.log('HttpHelper: Using absolute URLs for production web:', this.baseWoocommerceUrl);
    } else {
      // Development web builds use proxied URLs
      this.baseWoocommerceUrl = `/${environment.apiUrl}`;
      this.baseJwtUrl = `/wp-json/simple-jwt-login/v1`;
      console.log('HttpHelper: Using relative URLs for web development:', this.baseWoocommerceUrl);
    }
  }
  
  /**
   * Get the WooCommerce API URL
   */
  getWooCommerceUrl(endpoint: string = ''): string {
    // Clean up the endpoint
    endpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    // For mobile devices, we need to format the URL differently
    if (this.isMobile) {
      // Check if we're adding an endpoint or just getting the base URL
      if (endpoint && endpoint.length > 0) {
        return `${this.baseWoocommerceUrl}/${endpoint}`;
      }
      return this.baseWoocommerceUrl;
    }
    
    // For web usage (relative or absolute URLs)
    return endpoint ? `${this.baseWoocommerceUrl}/${endpoint}` : this.baseWoocommerceUrl;
  }
  
  /**
   * Get the JWT API URL
   */
  getJwtUrl(endpoint: string = ''): string {
    // Clean up the endpoint
    endpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    // For mobile devices, handle URLs differently
    if (this.isMobile) {
      // Check if we're adding an endpoint or just getting the base URL
      if (endpoint && endpoint.length > 0) {
        return `${this.baseJwtUrl}/${endpoint}`;
      }
      return this.baseJwtUrl;
    }
    
    // For web usage (relative or absolute URLs)
    return endpoint ? `${this.baseJwtUrl}/${endpoint}` : this.baseJwtUrl;
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
    
    // Add custom headers for debugging
    const headers = new HttpHeaders({
      'User-Agent': 'DRZN-App/1.0 Ionic-Angular',
      'X-App-Platform': this.isMobile ? 'mobile' : 'web',
      'X-App-Mode': this.isProduction ? 'production' : 'development'
    });
    
    console.log(`Making GET request to WooCommerce endpoint: ${url}`);
    console.log('Request params:', JSON.stringify(params));
    
    return this.http.get<T>(url, { 
      params: httpParams,
      headers: headers
    }).pipe(
      catchError(error => {
        // Log detailed error information
        console.error(`Error in request to ${url}:`, {
          status: error.status,
          statusText: error.statusText,
          error: JSON.stringify(error.error),
          message: error.message,
          name: error.name,
          url: error.url
        });
        
        // Additionally log the stack trace if available
        if (error.stack) {
          console.error(`Error stack trace for ${url}:`, error.stack);
        }
        
        // Forward the error to be handled by the caller
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Make a POST request to the WooCommerce API
   */
  postToWooCommerce<T>(endpoint: string, body: any, params: Record<string, any> = {}): Observable<T> {
    const url = this.getWooCommerceUrl(endpoint);
    const httpParams = this.createWooCommerceParams(params);
    
    // Add custom headers for debugging
    const headers = new HttpHeaders({
      'User-Agent': 'DRZN-App/1.0 Ionic-Angular',
      'X-App-Platform': this.isMobile ? 'mobile' : 'web',
      'X-App-Mode': this.isProduction ? 'production' : 'development'
    });
    
    console.log(`Making POST request to WooCommerce endpoint: ${url}`);
    console.log('Request body:', JSON.stringify(body));
    console.log('Request params:', JSON.stringify(params));
    
    return this.http.post<T>(url, body, { 
      params: httpParams,
      headers: headers 
    }).pipe(
      catchError(error => {
        console.error(`Error in POST request to ${url}:`, {
          status: error.status,
          statusText: error.statusText,
          error: JSON.stringify(error.error),
          message: error.message,
          name: error.name,
          url: error.url
        });
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Make a PUT request to the WooCommerce API
   */
  putToWooCommerce<T>(endpoint: string, body: any, params: Record<string, any> = {}): Observable<T> {
    const url = this.getWooCommerceUrl(endpoint);
    const httpParams = this.createWooCommerceParams(params);
    
    // Add custom headers for debugging
    const headers = new HttpHeaders({
      'User-Agent': 'DRZN-App/1.0 Ionic-Angular',
      'X-App-Platform': this.isMobile ? 'mobile' : 'web',
      'X-App-Mode': this.isProduction ? 'production' : 'development'
    });
    
    console.log(`Making PUT request to WooCommerce endpoint: ${url}`);
    console.log('Request body:', JSON.stringify(body));
    console.log('Request params:', JSON.stringify(params));
    
    return this.http.put<T>(url, body, { 
      params: httpParams,
      headers: headers
    }).pipe(
      catchError(error => {
        console.error(`Error in PUT request to ${url}:`, {
          status: error.status,
          statusText: error.statusText,
          error: JSON.stringify(error.error),
          message: error.message,
          name: error.name,
          url: error.url
        });
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Make a DELETE request to the WooCommerce API
   */
  deleteFromWooCommerce<T>(endpoint: string, params: Record<string, any> = {}): Observable<T> {
    const url = this.getWooCommerceUrl(endpoint);
    const httpParams = this.createWooCommerceParams(params);
    
    // Add custom headers for debugging
    const headers = new HttpHeaders({
      'User-Agent': 'DRZN-App/1.0 Ionic-Angular',
      'X-App-Platform': this.isMobile ? 'mobile' : 'web',
      'X-App-Mode': this.isProduction ? 'production' : 'development'
    });
    
    console.log(`Making DELETE request to WooCommerce endpoint: ${url}`);
    console.log('Request params:', JSON.stringify(params));
    
    return this.http.delete<T>(url, { 
      params: httpParams,
      headers: headers
    }).pipe(
      catchError(error => {
        console.error(`Error in DELETE request to ${url}:`, {
          status: error.status,
          statusText: error.statusText,
          error: JSON.stringify(error.error),
          message: error.message,
          name: error.name,
          url: error.url
        });
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Make a GET request to the JWT API
   */
  getFromJwt<T>(endpoint: string): Observable<T> {
    const url = this.getJwtUrl(endpoint);
    
    // Add custom headers for debugging
    const headers = new HttpHeaders({
      'User-Agent': 'DRZN-App/1.0 Ionic-Angular',
      'X-App-Platform': this.isMobile ? 'mobile' : 'web',
      'X-App-Mode': this.isProduction ? 'production' : 'development'
    });
    
    console.log(`Making GET request to JWT endpoint: ${url}`);
    
    return this.http.get<T>(url, { headers }).pipe(
      catchError(error => {
        console.error(`Error in GET request to JWT endpoint ${url}:`, {
          status: error.status,
          statusText: error.statusText,
          error: JSON.stringify(error.error),
          message: error.message,
          name: error.name,
          url: error.url
        });
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Make a POST request to the JWT API
   */
  postToJwt<T>(endpoint: string, body: any): Observable<T> {
    const url = this.getJwtUrl(endpoint);
    
    // Add custom headers for debugging
    const headers = new HttpHeaders({
      'User-Agent': 'DRZN-App/1.0 Ionic-Angular',
      'X-App-Platform': this.isMobile ? 'mobile' : 'web',
      'X-App-Mode': this.isProduction ? 'production' : 'development'
    });
    
    console.log(`Making POST request to JWT endpoint: ${url}`);
    console.log('Request body:', JSON.stringify(body));
    
    return this.http.post<T>(url, body, { headers }).pipe(
      catchError(error => {
        console.error(`Error in POST request to JWT endpoint ${url}:`, {
          status: error.status,
          statusText: error.statusText,
          error: JSON.stringify(error.error),
          message: error.message,
          name: error.name,
          url: error.url
        });
        return throwError(() => error);
      })
    );
  }
}