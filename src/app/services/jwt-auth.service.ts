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

  // Use proxy to avoid CORS issues
  private baseUrl = environment.apiUrl.split('/wp-json')[0]; // Get the base URL without wp-json
  private apiUrl = `${this.baseUrl}/wp-json/simple-jwt-login/v1`;
  private authCode = environment.authCode;

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
    this.loadAuthData();
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
   * Load authentication data from storage on service initialization
   */
  private async loadAuthData() {
    try {
      this.isLoadingSubject.next(true);
      const token = await this.storage.get(this.AUTH_TOKEN_KEY);
      const user = await this.storage.get(this.AUTH_USER_KEY);

      // Always load user data if available, don't wait for token refresh
      if (user) {
        console.log('User data found in storage, restoring session');
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
   * Create a minimal user object with basic user data
   */
  private createMinimalUser(userData: {
    email: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): User {
    return {
      id: 0, // Will be updated when we fetch the full user profile
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
              console.error('Auto-login after registration failed', loginError);
              // Even if auto-login fails, registration was successful
              // Create minimal user with provided info
              const minimalUser = this.createMinimalUser(userData);
              this.storage.set(this.AUTH_USER_KEY, minimalUser);
              this.currentUserSubject.next(minimalUser);
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
   */
  refreshToken(): Observable<string> {
    return from(this.getToken()).pipe(
      switchMap(token => {
        if (!token) {
          return throwError(() => new Error('No token to refresh'));
        }

        // Create FormData object for multipart/form-data submission
        const formData = new FormData();
        formData.append('AUTH_KEY', this.authCode);
        formData.append('JWT', token);

        return this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, formData).pipe(
          map(response => {
            if (!response.success || !response.data?.jwt) {
              throw new Error(response.error || 'Failed to refresh token');
            }

            // Store the new token
            this.storage.set(this.AUTH_TOKEN_KEY, response.data.jwt);
            return response.data.jwt;
          })
        );
      })
    );
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
    const user = await this.storage.get(this.AUTH_USER_KEY);
    return user || null as any;
  }
  
  /**
   * Fetch user profile from WooCommerce API using consumer keys
   */
  private fetchUserProfile(email: string): Observable<User> {
    return from(this.getToken()).pipe(
      switchMap(token => {
        if (!token) {
          return throwError(() => new Error('No token available to fetch user profile'));
        }
        
        // WooCommerce API requires consumer key/secret authentication
        const consumerKey = environment.consumerKey;
        const consumerSecret = environment.consumerSecret;
        
        // Use the WooCommerce REST API to fetch the user by email
        return this.http.get<User>(`${environment.apiUrl}/customers?email=${email}&consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`).pipe(
          map((customers: any) => {
            console.log('User profile response:', customers);
            
            if (Array.isArray(customers) && customers.length > 0) {
              const user = customers[0] as User;
              // Store the user data
              this.storage.set(this.AUTH_USER_KEY, user);
              this.currentUserSubject.next(user);
              return user;
            } else {
              // If we can't find the user, create a minimal user profile
              const minimalUser = {
                id: 0,
                email: email,
                username: email,
                first_name: '',
                last_name: '',
                date_created: new Date().toISOString(),
                date_modified: new Date().toISOString(),
                role: 'customer',
                is_paying_customer: false,
                avatar_url: '',
                billing: {
                  first_name: '',
                  last_name: '',
                  company: '',
                  address_1: '',
                  address_2: '',
                  city: '',
                  state: '',
                  postcode: '',
                  country: '',
                  email: email,
                  phone: ''
                },
                shipping: {
                  first_name: '',
                  last_name: '',
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
              
              this.storage.set(this.AUTH_USER_KEY, minimalUser);
              this.currentUserSubject.next(minimalUser);
              return minimalUser;
            }
          }),
          catchError(error => {
            console.error('Error fetching user profile:', error);
            
            // If the API call fails, fall back to a minimal user
            const minimalUser = {
              id: 0,
              email: email,
              username: email,
              first_name: '',
              last_name: '',
              date_created: new Date().toISOString(),
              date_modified: new Date().toISOString(),
              role: 'customer',
              is_paying_customer: false,
              avatar_url: '',
              billing: {
                first_name: '',
                last_name: '',
                company: '',
                address_1: '',
                address_2: '',
                city: '',
                state: '',
                postcode: '',
                country: '',
                email: email,
                phone: ''
              },
              shipping: {
                first_name: '',
                last_name: '',
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
            
            this.storage.set(this.AUTH_USER_KEY, minimalUser);
            this.currentUserSubject.next(minimalUser);
            return of(minimalUser);
          })
        );
      })
    );
  }
}