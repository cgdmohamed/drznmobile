import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Platform } from '@ionic/angular';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, timeout, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConnectivityTesterService {
  private isMobile: boolean;
  private isProduction: boolean;

  constructor(
    private http: HttpClient,
    private platform: Platform
  ) {
    this.isMobile = this.platform.is('hybrid') || 
                    this.platform.is('capacitor') || 
                    this.platform.is('cordova');
    this.isProduction = environment.production;
    
    console.log(`ConnectivityTesterService initialized. Mobile: ${this.isMobile}, Production: ${this.isProduction}`);
  }

  /**
   * Test connectivity to the WooCommerce API
   */
  testWooCommerceConnectivity(): Observable<any> {
    // Skip actual testing in mobile environments to avoid CORS issues
    if (this.isMobile) {
      console.log('Mobile environment: Assuming WooCommerce API is accessible');
      return of({ success: true, message: 'WooCommerce API is accessible (assumed in mobile)' });
    }
    
    // Use minimal headers to avoid CORS issues
    const headers = new HttpHeaders({
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });

    let url: string;

    if (this.isProduction) {
      // Use absolute URL for production
      url = `https://${environment.storeUrl}/${environment.apiUrl}/products`;
    } else {
      // Use relative URL for web development
      url = `/${environment.apiUrl}/products`;
    }

    // Add the authentication parameters and limit to 1 product
    url += `?consumer_key=${environment.consumerKey}&consumer_secret=${environment.consumerSecret}&per_page=1`;
    
    console.log(`Testing connectivity to WooCommerce API: ${url}`);
    
    return this.http.get(url, { 
      headers,
      params: {
        // Add timestamp to prevent caching
        _ts: Date.now().toString()
      }
    })
    .pipe(
      timeout(10000), // 10 second timeout
      tap(response => {
        console.log('WooCommerce connectivity test successful:', response);
      }),
      map(() => ({ success: true, message: 'Successfully connected to WooCommerce API' })),
      catchError(error => {
        // If we get a 401 or 403, that still means the API is reachable
        // It's just an authentication issue
        if (error.status === 401 || error.status === 403) {
          console.log('Got authentication error from API, but server is reachable');
          return of({ 
            success: true, 
            message: 'WooCommerce API is reachable but returned an authentication error. Check your API keys.'
          });
        }
        
        console.error('WooCommerce connectivity test failed:', error);
        return of({ 
          success: false, 
          message: `Failed to connect to WooCommerce API: ${error.message}`,
          status: error.status,
          error: error
        });
      })
    );
  }

  /**
   * Test general network connectivity
   */
  testGeneralConnectivity(): Observable<any> {
    // In a native app environment, skip actual network test to avoid CORS
    if (this.isMobile) {
      console.log('Testing general connectivity: Assuming connection in mobile environment');
      return of({ success: true, message: 'Internet connection is available (assumed in mobile)' });
    } 
    
    // For web browser testing only
    const url = 'https://www.google.com/generate_204';
    console.log(`Testing general connectivity using: ${url} (web only)`);
    
    return this.http.get(url, { 
      responseType: 'text',
      headers: new HttpHeaders({
        'Cache-Control': 'no-cache'
      })
    }).pipe(
      timeout(5000),
      map(() => ({ success: true, message: 'Internet connection is available' })),
      catchError(error => {
        // If we get a 404 but can reach the server, that's still a success for connectivity test
        if (error.status === 404) {
          console.log('Got 404 for favicon but server is reachable, considering connectivity successful');
          return of({ success: true, message: 'Internet connection is available (resource not found but server reachable)' });
        }
        
        console.error('General connectivity test failed:', error);
        return of({ 
          success: false, 
          message: 'No internet connection available.',
          error: error
        });
      })
    );
  }

  /**
   * Test domain resolution
   */
  testDomainResolution(): Observable<any> {
    // Skip actual testing in mobile environments to avoid CORS issues
    if (this.isMobile) {
      console.log('Mobile environment: Assuming domain is resolvable');
      return of({ success: true, message: `Domain ${environment.storeUrl} is accessible (assumed in mobile)` });
    }
    
    const domain = environment.storeUrl;
    // Try to access the WooCommerce API directly with minimal headers
    const url = `https://${domain}/wp-json/wc/v3/system_status?consumer_key=${environment.consumerKey}&consumer_secret=${environment.consumerSecret}`;
    
    console.log(`Testing domain resolution for: ${url}`);
    
    return this.http.get(url, { 
      headers: new HttpHeaders({
        'Cache-Control': 'no-cache'
      })
    })
    .pipe(
      timeout(5000),
      map(() => ({ success: true, message: `Domain ${domain} is accessible` })),
      catchError(error => {
        // Check if we got a response with status code
        // Any response with status code means we successfully resolved the domain
        if (error.status && error.status > 0) {
          console.log(`Got status ${error.status} from domain, considering domain resolution successful`);
          return of({ success: true, message: `Domain ${domain} is accessible (status: ${error.status})` });
        }
        
        console.error(`Domain resolution test failed for ${domain}:`, error);
        return of({ 
          success: false, 
          message: `Failed to resolve domain ${domain}: ${error.message}`,
          error: error
        });
      })
    );
  }

  /**
   * Run all connectivity tests
   */
  runAllTests(): Observable<any> {
    console.log('Running all connectivity tests...');
    
    // For mobile devices, skip actual tests to avoid CORS issues
    if (this.isMobile) {
      console.log('Mobile environment: Skipping actual connectivity tests');
      return of({
        general: { success: true, message: 'Internet connection is available (assumed)' },
        domain: { success: true, message: `Domain ${environment.storeUrl} is accessible (assumed)` },
        wooCommerce: { success: true, message: 'WooCommerce API is accessible (assumed)' },
        overallSuccess: true,
        message: 'All connectivity tests passed (assumed in mobile environment).'
      });
    }
    
    // Begin with general internet connectivity test for web browsers
    return this.testGeneralConnectivity().pipe(
      switchMap(generalResult => {
        if (!generalResult.success) {
          console.error('General connectivity test failed, skipping other tests.');
          return of({
            general: generalResult,
            domain: null,
            wooCommerce: null,
            overallSuccess: false,
            message: 'No internet connection available.'
          });
        }
        
        console.log('General connectivity test passed, continuing with domain test.');
        
        return this.testDomainResolution().pipe(
          switchMap(domainResult => {
            if (!domainResult.success) {
              console.error('Domain resolution test failed, skipping WooCommerce test.');
              return of({
                general: generalResult,
                domain: domainResult,
                wooCommerce: null,
                overallSuccess: false,
                message: `Cannot resolve domain ${environment.storeUrl}`
              });
            }
            
            console.log('Domain resolution test passed, continuing with WooCommerce test.');
            
            return this.testWooCommerceConnectivity().pipe(
              map(wooCommerceResult => {
                return {
                  general: generalResult,
                  domain: domainResult,
                  wooCommerce: wooCommerceResult,
                  overallSuccess: wooCommerceResult.success,
                  message: wooCommerceResult.success 
                    ? 'All connectivity tests passed.'
                    : `WooCommerce API test failed: ${wooCommerceResult.message}`
                };
              })
            );
          })
        );
      })
    );
  }
}