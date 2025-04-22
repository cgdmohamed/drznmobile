import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { environment } from '../../environments/environment';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

interface AuthResponse {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

interface User {
  email: string;
  name: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class JwtAuthService {
  private authUrl = environment.jwtAuthUrl;
  private _isAuthenticated = new BehaviorSubject<boolean>(false);
  private _user = new BehaviorSubject<User | null>(null);
  private _token = new BehaviorSubject<string | null>(null);
  
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  
  constructor(
    private http: HttpClient,
    private storage: Storage,
    private toastController: ToastController,
    private router: Router
  ) {
    this.initialize();
  }
  
  /**
   * Initialize the auth service
   */
  async initialize() {
    await this.checkToken();
  }
  
  /**
   * Check if there's a token in storage
   */
  private async checkToken() {
    try {
      const token = await this.storage.get(this.TOKEN_KEY);
      const user = await this.storage.get(this.USER_KEY);
      
      if (token && user) {
        this._token.next(token);
        this._user.next(user);
        this._isAuthenticated.next(true);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking token:', error);
      return false;
    }
  }
  
  /**
   * Get authentication state as an observable
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
   * Get user as an observable
   */
  get user(): Observable<User | null> {
    return this._user.asObservable();
  }
  
  /**
   * Get current user
   */
  get userValue(): User | null {
    return this._user.getValue();
  }
  
  /**
   * Get token as an observable
   */
  get token(): Observable<string | null> {
    return this._token.asObservable();
  }
  
  /**
   * Get current token
   */
  get tokenValue(): string | null {
    return this._token.getValue();
  }
  
  /**
   * Login with username and password
   * @param username Username or email
   * @param password Password
   */
  login(username: string, password: string): Observable<any> {
    return this.http.post<AuthResponse>(this.authUrl, {
      username,
      password
    }).pipe(
      tap(response => this.handleAuthResponse(response)),
      catchError(error => {
        console.error('Login error:', error);
        this.presentToast('Login failed: ' + (error.error?.message || 'Unknown error'));
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Handle the auth response from the server
   * @param response The auth response from the server
   */
  private async handleAuthResponse(response: AuthResponse) {
    if (response && response.token) {
      const user: User = {
        email: response.user_email,
        name: response.user_nicename,
        displayName: response.user_display_name
      };
      
      // Save to storage
      await this.storage.set(this.TOKEN_KEY, response.token);
      await this.storage.set(this.USER_KEY, user);
      
      // Update subjects
      this._token.next(response.token);
      this._user.next(user);
      this._isAuthenticated.next(true);
      
      this.presentToast('Login successful');
    }
  }
  
  /**
   * Register a new user
   * @param userData The user registration data
   */
  register(userData: any): Observable<any> {
    // This is a placeholder. In a real app, you would have a WP registration endpoint
    // For now, we'll simulate registration success
    
    // For demo purposes, we'll just show how to integrate with WP registration
    // In a real app, you'd have an endpoint like /wp-json/wp/v2/users or a custom endpoint
    
    const demoSuccess = true;
    
    if (demoSuccess) {
      return of({ success: true, message: 'Registration successful. Please log in.' })
        .pipe(
          tap(_ => this.presentToast('Registration successful. Please log in.'))
        );
    } else {
      return throwError(() => new Error('Registration failed'));
    }
  }
  
  /**
   * Logout the current user
   */
  async logout() {
    // Clear storage
    await this.storage.remove(this.TOKEN_KEY);
    await this.storage.remove(this.USER_KEY);
    
    // Update subjects
    this._token.next(null);
    this._user.next(null);
    this._isAuthenticated.next(false);
    
    this.presentToast('Logged out successfully');
    this.router.navigate(['/login']);
  }
  
  /**
   * Forgot password request
   * @param email The email to send password reset to
   */
  forgotPassword(email: string): Observable<any> {
    // This is a placeholder. In a real app, you would have a WP password reset endpoint
    
    // For demo purposes
    return of({ success: true, message: 'Password reset instructions sent to your email.' })
      .pipe(
        tap(_ => this.presentToast('Password reset instructions sent to your email.'))
      );
  }
  
  /**
   * Get the JWT token for API requests
   */
  getAuthToken(): string | null {
    return this.tokenValue;
  }
  
  /**
   * Present a toast message
   * @param message The message to display
   */
  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    
    await toast.present();
  }
}