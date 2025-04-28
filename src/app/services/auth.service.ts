import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { User } from '../interfaces/user.interface';
import { environment } from '../../environments/environment';
import { Storage } from '@ionic/storage-angular';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _user = new BehaviorSubject<User | null>(null);
  private _token = new BehaviorSubject<string | null>(null);
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private router: Router
  ) {
    this.init();
  }

  // Initialize storage
  async init() {
    // Create the storage database
    await this.storage.create();
    console.log('Auth service: Storage initialized');
  }

  // User observable
  get user(): Observable<User | null> {
    return this._user.asObservable();
  }

  // Token observable
  get token(): Observable<string | null> {
    return this._token.asObservable();
  }

  // Get current user value
  get userValue(): User | null {
    return this._user.value;
  }

  // Get current token value
  get tokenValue(): string | null {
    return this._token.value;
  }

  // Check if user is logged in
  get isLoggedIn(): boolean {
    return !!this._user.value;
  }

  // Auto login on app start
  autoLogin(): Observable<boolean> {
    return new Observable<boolean>(observer => {
      Promise.all([
        this.storage.get('user'),
        this.storage.get('token')
      ]).then(([user, token]) => {
        if (user && token) {
          this._user.next(user);
          this._token.next(token);
          observer.next(true);
        } else {
          observer.next(false);
        }
        observer.complete();
      }).catch(error => {
        console.error('Error during auto login', error);
        observer.next(false);
        observer.complete();
      });
    });
  }

  // Login user
  login(username: string, password: string): Observable<any> {
    const url = `${this.apiUrl}/wp-json/jwt-auth/v1/token`;
    const body = { username, password };
    
    return this.http.post<{token: string, user: any}>(url, body).pipe(
      tap(response => {
        // Extract the token from the response
        const token = response?.token;
        
        // Get user data from the JWT response
        const userData = response?.user || {};
        
        // Create a User object from the response
        const user: User = {
          id: userData.id || 0,
          date_created: userData.date_created || new Date().toISOString(),
          date_modified: userData.date_modified || new Date().toISOString(),
          email: userData.email || username,
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          role: userData.role || 'customer',
          username: userData.username || username,
          billing: userData.billing || {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: 'SA',
            email: username,
            phone: ''
          },
          shipping: userData.shipping || {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: 'SA'
          },
          is_paying_customer: userData.is_paying_customer || false,
          avatar_url: userData.avatar_url || '',
          meta_data: userData.meta_data || []
        };
        
        // Update the behavior subjects
        this._user.next(user);
        this._token.next(token);
        
        // Save to storage
        this.storage.set('user', user);
        this.storage.set('token', token);
      }),
      catchError(error => {
        console.error('Login error:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to login. Please check your credentials.'));
      })
    );
  }

  // Register a new user
  register(userData: any): Observable<any> {
    // First create the user account
    const createUserUrl = `${this.apiUrl}/wp-json/wc/v3/customers`;
    
    const customerData = {
      email: userData.email,
      first_name: userData.firstName,
      last_name: userData.lastName,
      username: userData.email,
      password: userData.password,
      billing: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        company: '',
        address_1: '',
        address_2: '',
        city: '',
        state: '',
        postcode: '',
        country: 'SA',
        email: userData.email,
        phone: userData.phone || ''
      },
      shipping: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        company: '',
        address_1: '',
        address_2: '',
        city: '',
        state: '',
        postcode: '',
        country: 'SA'
      }
    };
    
    // Add authentication parameters to URL
    const authParams = `?consumer_key=${environment.consumerKey}&consumer_secret=${environment.consumerSecret}`;
    
    return this.http.post(`${createUserUrl}${authParams}`, customerData).pipe(
      // After user creation is successful, login with the new credentials
      switchMap(response => {
        return this.login(userData.email, userData.password);
      }),
      catchError(error => {
        console.error('Registration error:', error);
        let errorMessage = 'Failed to register. Please try again.';
        
        // Check for common registration errors
        if (error.error?.message) {
          if (error.error.message.includes('already exists')) {
            errorMessage = 'This email or username is already registered. Please use a different one or try logging in.';
          } else {
            errorMessage = error.error.message;
          }
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // Logout user
  logout(): void {
    this._user.next(null);
    this._token.next(null);
    
    // Clear storage
    this.storage.remove('user');
    this.storage.remove('token');
    
    // Navigate to login page
    this.router.navigateByUrl('/login');
  }

  // Update user profile
  updateUserProfile(userData: Partial<User>): Observable<User> {
    const currentUser = this._user.value;
    
    if (!currentUser) {
      return throwError(() => new Error('User not logged in'));
    }
    
    // Create API endpoint URL
    const updateUrl = `${this.apiUrl}/wp-json/wc/v3/customers/${currentUser.id}`;
    const authParams = `?consumer_key=${environment.consumerKey}&consumer_secret=${environment.consumerSecret}`;
    
    return this.http.put<any>(`${updateUrl}${authParams}`, userData).pipe(
      map(response => {
        // Create updated user object
        const updatedUser: User = {
          ...currentUser,
          ...response
        };
        
        // Update state and storage
        this._user.next(updatedUser);
        this.storage.set('user', updatedUser);
        
        return updatedUser;
      }),
      catchError(error => {
        console.error('Error updating user profile:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to update profile. Please try again.'));
      })
    );
  }

  // Reset password
  forgotPassword(email: string): Observable<any> {
    // Use WordPress reset password endpoint
    const resetUrl = `${this.apiUrl}/wp-json/wp/v2/users/lostpassword`;
    const body = { user_login: email };
    
    return this.http.post(resetUrl, body).pipe(
      map(response => {
        return { success: true, message: 'Password reset email sent successfully.' };
      }),
      catchError(error => {
        console.error('Error requesting password reset:', error);
        return throwError(() => new Error('Failed to send password reset email. Please try again.'));
      })
    );
  }
}