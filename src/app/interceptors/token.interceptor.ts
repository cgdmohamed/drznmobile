import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, from, of } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { JwtAuthService } from '../services/jwt-auth.service';
import { Platform } from '@ionic/angular';
import { environment } from '../../environments/environment';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private apiUrl = environment.apiUrl;
  private storeUrl = environment.storeUrl;
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private isMobile: boolean;

  constructor(private jwtAuthService: JwtAuthService, private platform: Platform) {
    // Detect if we're on a mobile device or in production mode
    this.isMobile = this.platform.is('hybrid') || this.platform.is('capacitor') || this.platform.is('cordova');
    console.log(`TokenInterceptor initialized. Mobile: ${this.isMobile}, Production: ${environment.production}`);
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Skip adding custom headers for WooCommerce requests on mobile devices to avoid CORS issues
    const isWooCommerceRequest = request.url.includes('wp-json/wc/');
    
    // Only add these headers for non-WooCommerce requests to avoid CORS issues
    // Mobile devices will omit these headers entirely to avoid triggering CORS preflight
    if (!isWooCommerceRequest && !this.isMobile) {
      request = request.clone({
        setHeaders: {
          'X-App-Platform': this.isMobile ? 'mobile' : 'web',
          'X-App-Mode': environment.production ? 'production' : 'development',
          'X-App-Version': '1.0.0'
        }
      });
    }

    // Skip JWT token for OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      console.log('TokenInterceptor: Skipping JWT for OPTIONS request', request.url);
      return next.handle(request);
    }

    // Skip JWT token for WooCommerce endpoints that use consumer key/secret auth
    if (request.url.includes('consumer_key=') && request.url.includes('consumer_secret=')) {
      console.log('TokenInterceptor: Skipping JWT for WooCommerce request with consumer credentials', request.url);
      return next.handle(request);
    }
    
    // Determine if this is an API request
    let isApiRequest = false;
    
    // On mobile devices, assume all absolute URLs to our domain are API requests
    if (this.isMobile && request.url.includes(environment.storeUrl)) {
      isApiRequest = true;
      console.log('TokenInterceptor: Mobile device API request detected', request.url);
    } else {
      // For web, check if the request is to our API (handle both relative and absolute URLs)
      isApiRequest = request.url.includes('/wp-json/') || 
                     request.url.includes(`${environment.storeUrl}/wp-json/`) ||
                     request.url.includes(`https://${environment.storeUrl}/wp-json/`) ||
                     request.url.includes('wp-json');
    }
    
    if (isApiRequest && !request.url.includes('consumer_key=')) {
      console.log('TokenInterceptor: Adding JWT token to API request', request.url);
      return from(this.jwtAuthService.getToken()).pipe(
        switchMap(token => {
          if (token) {
            // Clone the request and add the authorization header
            request = this.addToken(request, token as string);
            console.log('TokenInterceptor: JWT token added successfully');
          } else {
            console.log('TokenInterceptor: No JWT token available to add');
          }
          
          return next.handle(request).pipe(
            catchError(error => {
              // Skip handling 200 OK responses as errors
              if (error instanceof HttpErrorResponse) {
                // Check if it's a 200 OK incorrectly treated as error
                if (error.status === 200) {
                  console.warn(`TokenInterceptor: HTTP error ${error.status} for ${request.url} with OK status - treating as success`, error);
                  // Return the response body as an observable
                  return of(error.error);
                }
                
                console.error(`TokenInterceptor: HTTP error ${error.status} for ${request.url}`, error);
                
                if (error.status === 401) {
                  // Handle token refresh and unauthorized errors
                  return this.handle401Error(request, next);
                }
              } else {
                console.error('TokenInterceptor: Non-HTTP error', error);
              }
              return throwError(() => error);
            })
          );
        })
      );
    }
    
    // Pass through any other requests
    return next.handle(request);
  }

  /**
   * Add auth token to the request
   * @param request The original request
   * @param token The JWT token to add
   */
  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  /**
   * Handle 401 unauthorized errors by attempting token refresh
   * @param request The original request
   * @param next The next handler
   */
  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      // Use force refresh to ensure we get a new token
      return this.jwtAuthService.refreshToken(true).pipe(
        switchMap((token: string) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(token);
          return next.handle(this.addToken(request, token));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          
          // Check if this is a network error
          if (err instanceof HttpErrorResponse && !err.status) {
            console.error('Network error during token refresh. Will retry on next request.', err);
            // Don't logout on network errors - we'll try again later
            return throwError(() => new Error('Network error during authentication. Please check your connection.'));
          }
          
          // For other errors, logout the user
          console.error('Error refreshing token, logging out:', err);
          this.jwtAuthService.logout();
          return throwError(() => err);
        })
      );
    } else {
      // Wait until token is refreshed
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => {
          return next.handle(this.addToken(request, token));
        }),
        catchError(err => {
          // If waiting for refresh fails, try the request without a token
          // This allows non-authenticated API calls to still work
          console.warn('Error waiting for token refresh, continuing without token:', err);
          return next.handle(request);
        })
      );
    }
  }
}