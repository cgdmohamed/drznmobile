import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private apiUrl = environment.apiUrl;

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only intercept requests to our API
    if (request.url.startsWith(this.apiUrl)) {
      const token = this.authService.tokenValue;
      
      if (token) {
        // Clone the request and add the authorization header
        const authReq = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        
        return next.handle(authReq);
      }
    }
    
    // Pass through any other requests
    return next.handle(request);
  }
}