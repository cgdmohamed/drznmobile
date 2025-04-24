import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, switchMap, map } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { environment } from '../../environments/environment';
import { User } from '../interfaces/user.interface';

/**
 * JWT Authentication Response interface
 */
export interface JwtAuthResponse {
  success: boolean;
  data?: {
    jwt: string;
    user?: User;
  };
  error?: string;
  message?: string;
}

/**
 * JWT Validation Response interface
 */
export interface JwtValidationResponse {
  success: boolean;
  data?: {
    user: User;
    roles: string[];
    jwt: any;
  };
  error?: string;
}

/**
 * Token Storage Keys
 */
const JWT_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token'; // Not used with Simple JWT Login plugin but kept for extensibility
const USER_DATA_KEY = 'user_data';

@Injectable({
  providedIn: 'root'
})
export class JwtAuthService {
  private _isAuthenticated = new BehaviorSubject<boolean>(false);
  private _currentUser = new BehaviorSubject<User | null>(null);
  private apiUrl = environment.apiUrl;
  private jwtAuthEndpoint = `${this.apiUrl}/wp-json/simple-jwt-login/v1/auth`;
  private authCode = environment.jwtAuthCode || '';

  constructor(
    private http: HttpClient,
    private storage: Storage
  ) {
    this.loadStoredAuthData();
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): Observable<boolean> {
    return this._isAuthenticated.asObservable();
  }

  /**
   * Get current authentication state
   */
  get isAuthenticatedValue(): boolean {
    return this._isAuthenticated.getValue();
  }

  /**
   * Get current user as observable
   */
  get currentUser(): Observable<User | null> {
    return this._currentUser.asObservable();
  }

  /**
   * Get current user value
   */
  get currentUserValue(): User | null {
    return this._currentUser.getValue();
  }

  /**
   * Initialize and load stored auth data from storage
   */
  private async loadStoredAuthData() {
    try {
      const token = await this.storage.get(JWT_TOKEN_KEY);
      const userData = await this.storage.get(USER_DATA_KEY);
      
      if (token) {
        this._isAuthenticated.next(true);
        if (userData) {
          this._currentUser.next(userData);
        }
        
        // Validate the token
        this.validateToken(token).subscribe({
          next: (isValid) => {
            this._isAuthenticated.next(isValid);
            if (!isValid) {
              this.clearAuthData();
            }
          },
          error: () => {
            this.clearAuthData();
          }
        });
      } else {
        this.clearAuthData();
      }
    } catch (error) {
      console.error('Error loading auth data', error);
      this.clearAuthData();
    }
  }

  /**
   * Login with username/email and password
   * @param credentials Object containing email/username and password
   */
  login(credentials: {email?: string, username?: string, password: string}): Observable<JwtAuthResponse> {
    const loginData: any = {
      password: credentials.password,
      AUTH_CODE: this.authCode
    };
    
    // Add email or username based on what's provided
    if (credentials.email) {
      loginData.email = credentials.email;
    } else if (credentials.username) {
      loginData.username = credentials.username;
    } else {
      return throwError(() => new Error('Email or username is required'));
    }
    
    return this.http.post<JwtAuthResponse>(`${this.jwtAuthEndpoint}`, loginData).pipe(
      tap(response => {
        if (response.success && response.data?.jwt) {
          this.handleAuthentication(response.data.jwt);
        }
      }),
      catchError(error => {
        console.error('Login error', error);
        return throwError(() => new Error(error.error?.error || 'Login failed. Please check your credentials.'));
      })
    );
  }

  /**
   * Refresh the JWT token
   */
  refreshToken(): Observable<string> {
    return this.getToken().pipe(
      switchMap(token => {
        if (!token) {
          return throwError(() => new Error('No token found'));
        }
        
        return this.http.post<JwtAuthResponse>(`${this.jwtAuthEndpoint}/refresh`, {
          JWT: token,
          AUTH_CODE: this.authCode
        }).pipe(
          map(response => {
            if (response.success && response.data?.jwt) {
              this.handleAuthentication(response.data.jwt);
              return response.data.jwt;
            }
            throw new Error('Token refresh failed');
          })
        );
      }),
      catchError(error => {
        console.error('Token refresh error', error);
        this.logout();
        return throwError(() => new Error('Session expired. Please login again.'));
      })
    );
  }

  /**
   * Logout and clear authentication data
   */
  logout(): Observable<boolean> {
    return this.getToken().pipe(
      switchMap(token => {
        if (!token) {
          this.clearAuthData();
          return of(true);
        }
        
        return this.http.post<JwtAuthResponse>(`${this.jwtAuthEndpoint}/revoke`, {
          JWT: token,
          AUTH_CODE: this.authCode
        }).pipe(
          map(() => {
            this.clearAuthData();
            return true;
          }),
          catchError(() => {
            this.clearAuthData();
            return of(true);
          })
        );
      })
    );
  }

  /**
   * Validate a JWT token
   * @param token JWT token to validate
   */
  validateToken(token: string): Observable<boolean> {
    return this.http.post<JwtValidationResponse>(`${this.jwtAuthEndpoint}/validate`, {
      JWT: token,
      AUTH_CODE: this.authCode
    }).pipe(
      map(response => {
        if (response.success && response.data?.user) {
          // Update user data with fresh data from server
          this._currentUser.next(response.data.user);
          this.storage.set(USER_DATA_KEY, response.data.user);
          return true;
        }
        return false;
      }),
      catchError(() => {
        return of(false);
      })
    );
  }

  /**
   * Get the stored JWT token
   */
  getToken(): Observable<string | null> {
    return from(this.storage.get(JWT_TOKEN_KEY));
  }
  
  /**
   * Get current token value (synchronous)
   */
  get currentTokenValue(): string | null {
    // This is a synchronous getter that can be used by interceptors
    // We return null since we can't access storage synchronously
    return null;
  }

  /**
   * Handle successful authentication
   * @param token JWT token
   */
  private async handleAuthentication(token: string): Promise<void> {
    this._isAuthenticated.next(true);
    
    // Store the token
    await this.storage.set(JWT_TOKEN_KEY, token);
    
    // Validate the token to get user data
    this.validateToken(token).subscribe();
  }

  /**
   * Clear all authentication data
   */
  private async clearAuthData(): Promise<void> {
    this._isAuthenticated.next(false);
    this._currentUser.next(null);
    
    await this.storage.remove(JWT_TOKEN_KEY);
    await this.storage.remove(REFRESH_TOKEN_KEY);
    await this.storage.remove(USER_DATA_KEY);
  }

  /**
   * Generate auto-login URL for web use
   * This would be used for opening a browser for authentication if needed
   * @param redirectUrl URL to redirect after successful login
   */
  getAutoLoginUrl(redirectUrl?: string): Observable<string> {
    return this.getToken().pipe(
      map(token => {
        if (!token) {
          throw new Error('No token found');
        }
        
        let url = `${this.apiUrl}?rest_route=/simple-jwt-login/v1/autologin&JWT=${token}`;
        
        if (this.authCode) {
          url += `&AUTH_CODE=${this.authCode}`;
        }
        
        if (redirectUrl) {
          url += `&redirectUrl=${encodeURIComponent(redirectUrl)}`;
        }
        
        return url;
      })
    );
  }
  
  /**
   * Get the auto-login URL as a promise (convenience method)
   * @param redirectUrl URL to redirect after successful login
   */
  async getAutoLoginUrlAsync(redirectUrl?: string): Promise<string> {
    try {
      // Use firstValueFrom instead of deprecated toPromise
      return await new Promise<string>((resolve, reject) => {
        this.getAutoLoginUrl(redirectUrl).subscribe({
          next: (url) => resolve(url),
          error: (err) => reject(err)
        });
      });
    } catch (error) {
      console.error('Error getting auto-login URL:', error);
      throw error;
    }
  }
}

// Helper function to convert Promise to Observable
function from<T>(promise: Promise<T>): Observable<T> {
  return new Observable<T>((observer) => {
    promise
      .then((value) => {
        observer.next(value);
        observer.complete();
      })
      .catch((error) => {
        observer.error(error);
      });
  });
}