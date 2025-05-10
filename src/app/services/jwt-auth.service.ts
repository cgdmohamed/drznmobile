import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../interfaces/user.interface';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';

interface AuthResponse {
  success: boolean;
  data?: {
    jwt?: string;
    user?: User;
  };
  error?: string;
  message?: string;
  user?: User;
  jwt?: string;
  id?: number;
  roles?: string[];
  // For simple success/error responses
  status?: string;
  code?: string;
}

@Injectable({
  providedIn: 'root'
})
export class JwtAuthService {
  private AUTH_TOKEN_KEY = 'jwt_token';
  private AUTH_USER_KEY = 'auth_user';
  private AUTH_REFRESH_KEY = 'jwt_refresh_token';
  private AUTH_TOKEN_EXPIRY_KEY = 'jwt_token_expiry';
  private TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Platform detection
  private isMobile: boolean;
  private isProduction = environment.production;
  
  // API URL configuration - will be set based on platform
  private baseUrl: string;
  private apiUrl: string; 
  private authCode = environment.authCode;
  
  // Token refresh timer
  private tokenRefreshTimer: any;

  public currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private platform: Platform,
    private router: Router
  ) {
    // Detect if we're on a mobile device (Capacitor/Cordova)
    this.isMobile = this.platform.is('hybrid') || this.platform.is('capacitor') || this.platform.is('cordova');
    
    // Set URLs based on platform
    if (this.isMobile || this.isProduction) {
      // For mobile devices, use full URL
      this.baseUrl = `https://${environment.storeUrl}`;
      this.apiUrl = `${this.baseUrl}/wp-json/simple-jwt-login/v1`;
      console.log('JWT Auth: Using full API URL for mobile/production:', this.apiUrl);
    } else {
      // For web development, use relative URLs for proxy
      const apiBase = environment.apiUrl.split('/wp-json')[0] || ''; // Get the base URL without wp-json
      this.baseUrl = apiBase;
      this.apiUrl = `${this.baseUrl}/wp-json/simple-jwt-login/v1`;
      console.log('JWT Auth: Using relative API URL for web development:', this.apiUrl);
    }
    
    this.init();
  }
  
  /**
   * Initialize the service
   */
  async init() {
    // Create the storage database first
    await this.storage.create();
    console.log('JWT Auth service: Storage initialized');
    
    // Then load auth data
    await this.loadAuthData();
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }
  
  /**
   * Set the current user (used for restoring session)
   */
  setCurrentUser(user: User): void {
    if (user) {
      this.currentUserSubject.next(user);
    }
  }
  
  /**
   * Update user data in storage and current user subject
   */
  async updateUserData(userData: User): Promise<void> {
    // Update the user in storage
    await this.storage.set(this.AUTH_USER_KEY, userData);
    // Update the current user subject
    this.currentUserSubject.next(userData);
  }

  /**
   * Load authentication data from storage on service initialization
   */
  private async loadAuthData() {
    try {
      this.isLoadingSubject.next(true);
      const token = await this.storage.get(this.AUTH_TOKEN_KEY);
      let user = await this.storage.get(this.AUTH_USER_KEY);

      // HARDCODED: Ensure user has ID 95 if a valid user exists in storage
      if (user) {
        console.log('User data found in storage, restoring session');
        
        // Force user ID to 95 regardless of what was stored
        user.id = 95;
        
        // Update storage with modified user
        await this.storage.set(this.AUTH_USER_KEY, user);
        
        console.log('User ID hardcoded to 95 in loadAuthData');
        this.currentUserSubject.next(user);
      }

      if (token) {
        console.log('JWT token found, verifying...');
        
        // Try to refresh the token to make sure it's still valid, but don't block user session
        this.refreshToken().subscribe({
          next: () => {
            console.log('JWT token refreshed successfully');
          },
          error: (error) => {
            console.error('JWT token refresh failed', error);
            // Don't clear auth data on refresh failure - this might just be a temporary server issue
            // The token might still be valid
          }
        });
      }
    } catch (error) {
      console.error('Error loading auth data', error);
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Get user as an Observable
   */
  getUserAsObservable(): Observable<User | null> {
    return from(this.getUser());
  }
  
  /**
   * Create a minimal user object with basic user data
   */
  private createMinimalUser(userData: {
    email: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): User {
    return {
      id: 95, // HARDCODED: Using ID 95 as requested for valid user identification
      email: userData.email,
      username: userData.username || userData.email,
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      role: 'customer',
      is_paying_customer: false,
      avatar_url: '',
      billing: {
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        company: '',
        address_1: '',
        address_2: '',
        city: '',
        state: '',
        postcode: '',
        country: '',
        email: userData.email,
        phone: ''
      },
      shipping: {
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        company: '',
        address_1: '',
        address_2: '',
        city: '',
        state: '',
        postcode: '',
        country: ''
      },
      meta_data: []
    } as User;
  }

  /**
   * Log in with email/username and password
   */
  login(email: string, password: string): Observable<User> {
    this.isLoadingSubject.next(true);

    // Create FormData object for multipart/form-data submission
    const formData = new FormData();
    formData.append('AUTH_KEY', this.authCode);
    formData.append('email', email);
    formData.append('password', password);

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth`, formData).pipe(
      switchMap(response => {
        console.log('Login response:', response);
        
        if (!response.success) {
          throw new Error(response.error || response.message || 'Login failed');
        }

        // Store the JWT
        let token: string = '';
        if (response.data?.jwt) {
          token = response.data.jwt;
          this.storage.set(this.AUTH_TOKEN_KEY, token);
        } else if (response.jwt) {
          token = response.jwt;
          this.storage.set(this.AUTH_TOKEN_KEY, token);
        } else {
          throw new Error('No token received');
        }

        // Fetch user info from the WooCommerce API
        return this.fetchUserProfile(email);
      }),
      tap(user => {
        this.isLoadingSubject.next(false);
        
        // Note: we're not handling redirects here anymore.
        // The login page component handles redirection after successful login
        // based on query parameters and localStorage
      }),
      catchError(error => {
        this.isLoadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Register a new user
   */
  register(userData: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  }): Observable<User> {
    this.isLoadingSubject.next(true);

    // Create FormData object for multipart/form-data submission
    const formData = new FormData();
    formData.append('AUTH_KEY', this.authCode);
    formData.append('email', userData.email);
    formData.append('password', userData.password);
    
    if (userData.first_name) {
      formData.append('first_name', userData.first_name);
    }
    
    if (userData.last_name) {
      formData.append('last_name', userData.last_name);
    }
    
    if (userData.username) {
      formData.append('username', userData.username);
    } else {
      formData.append('username', userData.email); // Use email as username if not provided
    }

    return this.http.post<AuthResponse>(`${this.apiUrl}/users`, formData).pipe(
      switchMap(response => {
        console.log('Registration response:', response);
        
        // Check for success response
        if (response && (response.success === false || response.error)) {
          throw new Error(response.error || response.message || 'Registration failed');
        }

        // If we have a success response but no JWT, we need to login to get the JWT
        if (response.success && response.message && response.message.includes('User was')) {
          console.log('Registration successful, attempting automatic login');
          
          // Auto-login after successful registration
          const loginFormData = new FormData();
          loginFormData.append('AUTH_KEY', this.authCode);
          loginFormData.append('email', userData.email);
          loginFormData.append('password', userData.password);
          
          return this.http.post<AuthResponse>(`${this.apiUrl}/auth`, loginFormData).pipe(
            switchMap(loginResponse => {
              console.log('Auto-login response:', loginResponse);
              
              // Store JWT if present
              let token: string = '';
              if (loginResponse.data?.jwt) {
                token = loginResponse.data.jwt;
                this.storage.set(this.AUTH_TOKEN_KEY, token);
              } else if (loginResponse.jwt) {
                token = loginResponse.jwt;
                this.storage.set(this.AUTH_TOKEN_KEY, token);
              }
              
              // Fetch user profile from WooCommerce
              return this.fetchUserProfile(userData.email);
            }),
            catchError(loginError => {
              console.warn('Auto-login after registration failed, using minimal profile', loginError);
              // Even if auto-login fails, registration was successful
              // Create minimal user with provided info
              const minimalUser = this.createMinimalUser(userData);
              this.storage.set(this.AUTH_USER_KEY, minimalUser);
              this.currentUserSubject.next(minimalUser);
              
              // Make sure to redirect if we're on an auth page
              if (this.router) {
                setTimeout(() => {
                  const currentUrl = window.location.href;
                  if (currentUrl.includes('/login') || currentUrl.includes('/register')) {
                    console.log('Redirecting to home after successful registration');
                    this.router.navigate(['/']);
                  }
                }, 500);
              }
              
              return of(minimalUser);
            })
          );
        }
        
        // Standard flow if we got JWT in registration response
        if (response && response.jwt) {
          this.storage.set(this.AUTH_TOKEN_KEY, response.jwt);
        }

        // Extract user data if present in registration response
        if (response && response.user) {
          const user = response.user;
          this.storage.set(this.AUTH_USER_KEY, user);
          this.currentUserSubject.next(user);
          return of(user);
        }
        
        // Create minimal user as fallback
        const minimalUser = this.createMinimalUser(userData);
        this.storage.set(this.AUTH_USER_KEY, minimalUser);
        this.currentUserSubject.next(minimalUser);
        return of(minimalUser);
      }),
      tap(() => {
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        this.isLoadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout the user
   */
  logout(): Observable<boolean> {
    this.isLoadingSubject.next(true);

    // Get the token
    return from(this.getToken()).pipe(
      switchMap(token => {
        if (!token) {
          // If no token, just clear storage and complete
          return this.clearAuthData();
        }

        // Otherwise, try to revoke the token on the server
        // Create FormData object for multipart/form-data submission
        const formData = new FormData();
        formData.append('AUTH_KEY', this.authCode);
        formData.append('JWT', token);

        return this.http.post<AuthResponse>(`${this.apiUrl}/auth/revoke`, formData).pipe(
          tap(() => this.clearAuthData()),
          map(() => true), // Return success regardless of server response
          catchError(() => {
            // Even if server-side logout fails, clear local auth
            this.clearAuthData();
            return of(true);
          })
        );
      }),
      tap(() => {
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        this.isLoadingSubject.next(false);
        this.clearAuthData(); // Clear auth data even on error
        return throwError(() => error);
      })
    );
  }

  /**
   * Clear auth data from storage and reset current user
   */
  private clearAuthData(): Observable<boolean> {
    return from(Promise.all([
      this.storage.remove(this.AUTH_TOKEN_KEY),
      this.storage.remove(this.AUTH_USER_KEY),
      this.storage.remove(this.AUTH_REFRESH_KEY)
    ])).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
      }),
      map(() => true)
    );
  }

  /**
   * Request password reset (sends email with reset code)
   */
  requestPasswordReset(email: string): Observable<boolean> {
    this.isLoadingSubject.next(true);

    // Create FormData object for multipart/form-data submission
    const formData = new FormData();
    formData.append('AUTH_KEY', this.authCode);
    formData.append('email', email);

    return this.http.post<AuthResponse>(`${this.apiUrl}/users/reset_password`, formData).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || response.message || 'Password reset request failed');
        }
        return true;
      }),
      tap(() => {
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        this.isLoadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Reset password with code and new password
   */
  resetPassword(email: string, resetCode: string, newPassword: string): Observable<boolean> {
    this.isLoadingSubject.next(true);

    // Create FormData object for multipart/form-data submission
    const formData = new FormData();
    formData.append('AUTH_KEY', this.authCode);
    formData.append('email', email);
    formData.append('code', resetCode);
    formData.append('new_password', newPassword);

    return this.http.post<AuthResponse>(`${this.apiUrl}/users/reset_password/code`, formData).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || response.message || 'Password reset failed');
        }
        return true;
      }),
      tap(() => {
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        this.isLoadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Change user password (when already logged in)
   */
  changePassword(oldPassword: string, newPassword: string): Observable<boolean> {
    this.isLoadingSubject.next(true);

    return from(this.getToken()).pipe(
      switchMap(token => {
        if (!token) {
          return throwError(() => new Error('Not authenticated'));
        }

        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`
        });

        // Create FormData object for multipart/form-data submission
        const formData = new FormData();
        formData.append('AUTH_KEY', this.authCode);
        formData.append('old_password', oldPassword);
        formData.append('new_password', newPassword);

        return this.http.post<AuthResponse>(`${this.apiUrl}/users/change_password`, formData, { headers }).pipe(
          map(response => {
            if (!response.success) {
              throw new Error(response.error || response.message || 'Password change failed');
            }
            return true;
          })
        );
      }),
      tap(() => {
        this.isLoadingSubject.next(false);
      }),
      catchError(error => {
        this.isLoadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Refresh the JWT token
   * @param forceRefresh Force token refresh even if it's not expired
   */
  refreshToken(forceRefresh: boolean = false): Observable<string> {
    // Clear any existing refresh timer
    this.clearTokenRefreshTimer();
    
    return from(Promise.all([
      this.getToken(),
      this.storage.get(this.AUTH_TOKEN_EXPIRY_KEY)
    ])).pipe(
      switchMap(([token, expiryTime]) => {
        if (!token) {
          return throwError(() => new Error('No token to refresh'));
        }

        // Check if token needs refreshing
        const now = Date.now();
        const tokenExpiry = expiryTime ? parseInt(expiryTime) : now;
        const shouldRefresh = forceRefresh || !expiryTime || (tokenExpiry - now < this.TOKEN_REFRESH_THRESHOLD_MS);
        
        if (!shouldRefresh) {
          console.log('Token is still valid, no need to refresh');
          // Set up refresh timer for future refresh
          this.scheduleTokenRefresh(tokenExpiry);
          return of(token);
        }

        console.log('Refreshing token...');
        
        // Create FormData object for multipart/form-data submission
        const formData = new FormData();
        formData.append('AUTH_KEY', this.authCode);
        formData.append('JWT', token);

        return this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, formData).pipe(
          map(response => {
            if (!response.success || !response.data?.jwt) {
              throw new Error(response.error || 'Failed to refresh token');
            }

            // Calculate token expiry (default to 24 hours from now if not provided)
            // JWT standard is to have an 'exp' claim in seconds
            // But our server might not provide this, so we estimate
            const newExpiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours in milliseconds
            
            // Store the new token and its expiry time
            this.storage.set(this.AUTH_TOKEN_KEY, response.data.jwt);
            this.storage.set(this.AUTH_TOKEN_EXPIRY_KEY, newExpiryTime.toString());
            
            // Schedule the next token refresh
            this.scheduleTokenRefresh(newExpiryTime);
            
            console.log('Token refreshed successfully');
            return response.data.jwt;
          }),
          catchError(error => {
            console.error('Token refresh failed:', error);
            // Don't throw here - the caller should decide what to do with the error
            return throwError(() => error);
          })
        );
      })
    );
  }
  
  /**
   * Schedule token refresh before it expires
   * @param expiryTime Timestamp when the token expires
   */
  private scheduleTokenRefresh(expiryTime: number): void {
    // Clear any existing timer
    this.clearTokenRefreshTimer();
    
    // Calculate time until refresh (5 minutes before expiry)
    const now = Date.now();
    const refreshTime = expiryTime - this.TOKEN_REFRESH_THRESHOLD_MS;
    const timeUntilRefresh = Math.max(0, refreshTime - now);
    
    if (timeUntilRefresh > 0) {
      console.log(`Scheduling token refresh in ${timeUntilRefresh/1000} seconds`);
      
      // Set timer to refresh token
      this.tokenRefreshTimer = setTimeout(() => {
        console.log('Auto refreshing token...');
        this.refreshToken().subscribe({
          next: () => console.log('Automatic token refresh successful'),
          error: (error) => console.error('Automatic token refresh failed:', error)
        });
      }, timeUntilRefresh);
    }
  }
  
  /**
   * Clear token refresh timer
   */
  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /**
   * Validate a JWT token and retrieve user information
   */
  private validateToken(token: string): Observable<User> {
    // Create FormData object for multipart/form-data submission
    const formData = new FormData();
    formData.append('AUTH_KEY', this.authCode);
    formData.append('JWT', token);

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/validate`, formData).pipe(
      map(response => {
        if (!response.success || !response.data?.user) {
          throw new Error(response.error || 'Token validation failed');
        }

        const user = response.data.user as User;
        
        // HARDCODED: Ensure user ID is 95 regardless of the response
        user.id = 95;
        console.log('User ID hardcoded to 95 in validateToken method');
        
        // Store user data
        this.storage.set(this.AUTH_USER_KEY, user);
        this.currentUserSubject.next(user);
        
        return user;
      })
    );
  }

  /**
   * Get the stored JWT token
   */
  async getToken(): Promise<string> {
    const token = await this.storage.get(this.AUTH_TOKEN_KEY);
    return token || '';
  }

  /**
   * Get the stored user data
   */
  async getUser(): Promise<User> {
    let user = await this.storage.get(this.AUTH_USER_KEY);
    
    if (user) {
      // HARDCODED: Ensure user always has ID 95
      if (user.id !== 95) {
        user.id = 95;
        console.log('User ID hardcoded to 95 in getUser method');
        // Update storage with corrected ID
        await this.storage.set(this.AUTH_USER_KEY, user);
      }
    }
    
    return user || null as any;
  }
  
  /**
   * Fetch user profile from WooCommerce API using consumer keys
   * If profile fetch fails, we'll still keep the user logged in with a minimal profile
   */
  private fetchUserProfile(email: string): Observable<User> {
    return from(this.getToken()).pipe(
      switchMap(token => {
        if (!token) {
          console.warn('No token available to fetch user profile, creating minimal user.');
          const minimalUser = this.createMinimalUser({ email });
          this.storage.set(this.AUTH_USER_KEY, minimalUser);
          this.currentUserSubject.next(minimalUser);
          return of(minimalUser);
        }
        
        try {
          // WooCommerce API requires consumer key/secret authentication
          const consumerKey = environment.consumerKey;
          const consumerSecret = environment.consumerSecret;
          
          // Use the WooCommerce REST API to fetch the user by email
          return this.http.get<User>(`${environment.apiUrl}/customers?email=${email}&consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`).pipe(
            map((customers: any) => {
              console.log('User profile response:', customers);
              
              if (Array.isArray(customers) && customers.length > 0) {
                const user = customers[0] as User;
                // HARDCODED: Ensure user ID is set to 95 regardless of the API response
                user.id = 95;
                console.log('Using hardcoded user ID: 95 for user profile');
                // Store the user data
                this.storage.set(this.AUTH_USER_KEY, user);
                this.currentUserSubject.next(user);
                return user;
              } else {
                console.log('No user found with this email, creating minimal user profile');
                // If we can't find the user, create a minimal user profile
                const minimalUser = this.createMinimalUser({ email });
                this.storage.set(this.AUTH_USER_KEY, minimalUser);
                this.currentUserSubject.next(minimalUser);
                return minimalUser;
              }
            }),
            catchError(error => {
              console.warn('Error fetching user profile, falling back to minimal user:', error);
              const minimalUser = this.createMinimalUser({ email });
              this.storage.set(this.AUTH_USER_KEY, minimalUser);
              this.currentUserSubject.next(minimalUser);
              return of(minimalUser);
            })
          );
        } catch (error) {
          console.error('Exception in fetchUserProfile:', error);
          const minimalUser = this.createMinimalUser({ email });
          this.storage.set(this.AUTH_USER_KEY, minimalUser);
          this.currentUserSubject.next(minimalUser);
          return of(minimalUser);
        }
      }),
      catchError(error => {
        console.error('Unhandled error in fetchUserProfile pipe:', error);
        const minimalUser = this.createMinimalUser({ email });
        this.storage.set(this.AUTH_USER_KEY, minimalUser);
        this.currentUserSubject.next(minimalUser);
        return of(minimalUser);
      })
    );
  }
}