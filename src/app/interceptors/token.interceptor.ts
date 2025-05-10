import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, from } from 'rxjs';
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
    // Skip JWT token for WooCommerce endpoints that use consumer key/secret auth
    if (request.url.includes('consumer_key=') && request.url.includes('consumer_secret=')) {
      return next.handle(request);
    }
    
    // Check if the request is to our API (handle both relative and absolute URLs)
    const isApiRequest = request.url.includes('/wp-json/') || 
                         request.url.includes(`${environment.storeUrl}/wp-json/`) ||
                         request.url.includes(`https://${environment.storeUrl}/wp-json/`);
    
    if (isApiRequest && !request.url.includes('consumer_key=')) {
      return from(this.jwtAuthService.getToken()).pipe(
        switchMap(token => {
          if (token) {
            // Clone the request and add the authorization header
            request = this.addToken(request, token as string);
          }
          
          return next.handle(request).pipe(
            catchError(error => {
              if (error instanceof HttpErrorResponse && error.status === 401) {
                // Handle token refresh and unauthorized errors
                return this.handle401Error(request, next);
              } else {
                return throwError(() => error);
              }
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