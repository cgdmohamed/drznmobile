import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from, throwError, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { environment } from '../../environments/environment';
import { User } from '../interfaces/user.interface';
import { ToastController } from '@ionic/angular';

interface AuthResponse {
  success: boolean;
  data?: {
    jwt_token: string;
    user_id: number;
    user?: User;
  };
  message?: string;
}

interface JwtPayload {
  user_id: number;
  user_email: string;
  iat: number;
  exp: number;
}

@Injectable({
  providedIn: 'root'
})
export class JwtAuthService {
  private apiUrl = environment.apiUrl;
  private jwtUrl = `${this.apiUrl}/simple-jwt-login`;
  private user = new BehaviorSubject<User | null>(null);
  private token = new BehaviorSubject<string | null>(null);
  private readonly TOKEN_KEY = 'jwt_token';
  private readonly USER_KEY = 'user_data';

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private toastController: ToastController
  ) {
    this.initializeAuth();
  }

  /**
   * Initialize the auth service
   */
  async initializeAuth() {
    try {
      // Ensure storage is created
      await this.storage.create();
      
      // Load token and user from storage
      const storedToken = await this.storage.get(this.TOKEN_KEY);
      const storedUser = await this.storage.get(this.USER_KEY);
      
      if (storedToken && storedUser) {
        // Check if token is expired
        if (this.isTokenExpired(storedToken)) {
          // Token expired, clear storage and subjects
          this.clearAuth();
          console.log('JWT token expired, logging out');
        } else {
          // Valid token, set user and token
          this.token.next(storedToken);
          this.user.next(storedUser);
          console.log('JWT token loaded from storage');
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }

  /**
   * Get current authenticated user as observable
   */
  get currentUser(): Observable<User | null> {
    return this.user.asObservable();
  }

  /**
   * Get current JWT token as observable
   */
  get currentToken(): Observable<string | null> {
    return this.token.asObservable();
  }

  /**
   * Get current user value (not as observable)
   */
  get currentUserValue(): User | null {
    return this.user.getValue();
  }

  /**
   * Get current token value (not as observable)
   */
  get currentTokenValue(): string | null {
    return this.token.getValue();
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated(): boolean {
    return !!this.currentTokenValue && !this.isTokenExpired(this.currentTokenValue);
  }

  /**
   * Register a new user
   * @param email User email
   * @param password User password
   * @param firstName User first name
   * @param lastName User last name
   * @param username User username (optional)
   */
  register(email: string, password: string, firstName: string, lastName: string, username?: string): Observable<any> {
    if (!username) {
      // Create username from email if not provided
      username = email.split('@')[0];
    }

    const registerData = {
      email,
      password,
      user_login: username,
      first_name: firstName,
      last_name: lastName
    };

    return this.http.post<AuthResponse>(`${this.jwtUrl}/register`, registerData).pipe(
      catchError(error => {
        console.error('Registration error:', error);
        const message = error.error?.message || 'Registration failed. Please try again.';
        this.presentToast(message, 'danger');
        return throwError(() => new Error(message));
      }),
      tap(response => {
        if (response.success && response.data) {
          this.presentToast('Registration successful', 'success');
        }
      })
    );
  }

  /**
   * Login with email and password
   * @param email User email
   * @param password User password
   */
  login(email: string, password: string): Observable<User> {
    const loginData = {
      email,
      password
    };

    return this.http.post<AuthResponse>(`${this.jwtUrl}/auth`, loginData).pipe(
      catchError(error => {
        console.error('Login error:', error);
        const message = error.error?.message || 'Login failed. Please check your credentials.';
        this.presentToast(message, 'danger');
        return throwError(() => new Error(message));
      }),
      map(response => {
        if (response.success && response.data) {
          return this.handleAuthentication(response.data.jwt_token, response.data.user);
        } else {
          throw new Error(response.message || 'Authentication failed');
        }
      })
    );
  }

  /**
   * Login with OTP
   * @param phoneNumber User phone number
   * @param otp OTP code
   */
  loginWithOTP(phoneNumber: string, otp: string): Observable<User> {
    const otpData = {
      phone: phoneNumber,
      otp_code: otp
    };

    return this.http.post<AuthResponse>(`${this.jwtUrl}/auth-otp`, otpData).pipe(
      catchError(error => {
        console.error('OTP login error:', error);
        const message = error.error?.message || 'OTP verification failed. Please try again.';
        this.presentToast(message, 'danger');
        return throwError(() => new Error(message));
      }),
      map(response => {
        if (response.success && response.data) {
          return this.handleAuthentication(response.data.jwt_token, response.data.user);
        } else {
          throw new Error(response.message || 'OTP verification failed');
        }
      })
    );
  }

  /**
   * Request OTP for a phone number
   * @param phoneNumber User phone number
   */
  requestOTP(phoneNumber: string): Observable<any> {
    return this.http.post<any>(`${this.jwtUrl}/request-otp`, { phone: phoneNumber }).pipe(
      catchError(error => {
        console.error('OTP request error:', error);
        const message = error.error?.message || 'Failed to send OTP. Please try again.';
        this.presentToast(message, 'danger');
        return throwError(() => new Error(message));
      }),
      tap(response => {
        if (response.success) {
          this.presentToast('OTP sent successfully', 'success');
        }
      })
    );
  }

  /**
   * Request password reset
   * @param email User email
   */
  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.jwtUrl}/forgot-password`, { email }).pipe(
      catchError(error => {
        console.error('Password reset request error:', error);
        const message = error.error?.message || 'Failed to request password reset. Please try again.';
        this.presentToast(message, 'danger');
        return throwError(() => new Error(message));
      }),
      tap(response => {
        if (response.success) {
          this.presentToast('Password reset instructions sent to your email', 'success');
        }
      })
    );
  }

  /**
   * Reset password with token
   * @param resetToken Password reset token
   * @param newPassword New password
   */
  resetPassword(resetToken: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.jwtUrl}/reset-password`, {
      reset_token: resetToken,
      password: newPassword
    }).pipe(
      catchError(error => {
        console.error('Password reset error:', error);
        const message = error.error?.message || 'Failed to reset password. Please try again.';
        this.presentToast(message, 'danger');
        return throwError(() => new Error(message));
      }),
      tap(response => {
        if (response.success) {
          this.presentToast('Password reset successful', 'success');
        }
      })
    );
  }

  /**
   * Validate JWT token
   * @param token JWT token to validate
   */
  validateToken(token: string): Observable<boolean> {
    return this.http.post<AuthResponse>(`${this.jwtUrl}/validate`, { jwt: token }).pipe(
      catchError(error => {
        console.error('Token validation error:', error);
        return of(false);
      }),
      map(response => {
        if (typeof response === 'boolean') {
          return response;
        }
        return response.success === true;
      })
    );
  }

  /**
   * Refresh JWT token
   */
  refreshToken(): Observable<string> {
    const currentToken = this.currentTokenValue;
    if (!currentToken) {
      return throwError(() => new Error('No token to refresh'));
    }

    return this.http.post<AuthResponse>(`${this.jwtUrl}/refresh`, { jwt: currentToken }).pipe(
      catchError(error => {
        console.error('Token refresh error:', error);
        this.logout();
        return throwError(() => new Error('Failed to refresh token'));
      }),
      map(response => {
        if (response.success && response.data) {
          const newToken = response.data.jwt_token;
          this.token.next(newToken);
          this.storage.set(this.TOKEN_KEY, newToken);
          return newToken;
        } else {
          throw new Error('Token refresh failed');
        }
      })
    );
  }

  /**
   * Get user profile
   */
  getUserProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/wp/v2/users/me`).pipe(
      catchError(error => {
        console.error('Get profile error:', error);
        return throwError(() => new Error('Failed to get user profile'));
      }),
      tap(user => {
        this.user.next(user);
        this.storage.set(this.USER_KEY, user);
      })
    );
  }

  /**
   * Update user profile
   * @param userData User data to update
   */
  updateUserProfile(userData: Partial<User>): Observable<User> {
    const userId = this.currentUserValue?.id;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.http.put<User>(`${this.apiUrl}/wp/v2/users/${userId}`, userData).pipe(
      catchError(error => {
        console.error('Update profile error:', error);
        this.presentToast('Failed to update profile', 'danger');
        return throwError(() => new Error('Failed to update profile'));
      }),
      tap(updatedUser => {
        // Merge with existing user data
        const currentUser = this.currentUserValue;
        const mergedUser = { ...currentUser, ...updatedUser };
        this.user.next(mergedUser);
        this.storage.set(this.USER_KEY, mergedUser);
        this.presentToast('Profile updated successfully', 'success');
      })
    );
  }

  /**
   * Logout user
   */
  logout(): Observable<any> {
    this.clearAuth();
    this.presentToast('You have been logged out', 'success');
    return from(Promise.resolve(true));
  }

  /**
   * Handle successful authentication
   * @param token JWT token
   * @param userData User data
   */
  private handleAuthentication(token: string, userData?: User): User {
    // Set token in state and storage
    this.token.next(token);
    this.storage.set(this.TOKEN_KEY, token);
    
    let user: User;
    
    if (userData) {
      // If user data is provided in auth response
      user = userData;
      this.user.next(user);
      this.storage.set(this.USER_KEY, user);
    } else {
      // Extract user ID from token payload
      const payload = this.parseJwt(token);
      
      // Create minimal user object (will be updated from getUserProfile)
      user = {
        id: payload.user_id,
        email: payload.user_email,
        username: '',
        first_name: '',
        last_name: '',
        role: '',
        date_created: '',
        date_modified: '',
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
          email: '',
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
        is_paying_customer: false,
        avatar_url: '',
        meta_data: []
      };
      
      this.user.next(user);
      this.storage.set(this.USER_KEY, user);
      
      // Fetch full user profile
      this.getUserProfile().subscribe();
    }
    
    this.presentToast('Login successful', 'success');
    return user;
  }

  /**
   * Clear authentication data
   */
  private clearAuth() {
    this.token.next(null);
    this.user.next(null);
    this.storage.remove(this.TOKEN_KEY);
    this.storage.remove(this.USER_KEY);
  }

  /**
   * Parse JWT token to get payload
   * @param token JWT token
   */
  private parseJwt(token: string): JwtPayload {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return {
        user_id: 0,
        user_email: '',
        iat: 0,
        exp: 0
      };
    }
  }

  /**
   * Check if token is expired
   * @param token JWT token
   */
  private isTokenExpired(token: string): boolean {
    try {
      const decoded = this.parseJwt(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch (error) {
      return true; // Assume expired on error
    }
  }

  /**
   * Present toast message
   * @param message Message to display
   * @param color Toast color (success, danger, etc.)
   */
  private async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}