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
import { environment } from '../../environments/environment';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private apiUrl = environment.apiUrl;
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private jwtAuthService: JwtAuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only intercept requests to our API
    if (request.url.startsWith(this.apiUrl)) {
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

      return this.jwtAuthService.refreshToken().pipe(
        switchMap((token: string) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(token);
          return next.handle(this.addToken(request, token));
        }),
        catchError((err) => {
          this.isRefreshing = false;
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
        })
      );
    }
  }
}