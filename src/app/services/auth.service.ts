import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
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
    // In a real application, this would connect to WooCommerce JWT Auth
    // For demo purposes, we're using a simulated response
    const demoUser: User = {
      id: 1,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      email: username,
      first_name: 'مستخدم',
      last_name: 'تجريبي',
      role: 'customer',
      username: username,
      billing: {
        first_name: 'مستخدم',
        last_name: 'تجريبي',
        company: '',
        address_1: 'شارع الرياض',
        address_2: '',
        city: 'الرياض',
        state: '',
        postcode: '12345',
        country: 'SA',
        email: username,
        phone: '05xxxxxxxx'
      },
      shipping: {
        first_name: 'مستخدم',
        last_name: 'تجريبي',
        company: '',
        address_1: 'شارع الرياض',
        address_2: '',
        city: 'الرياض',
        state: '',
        postcode: '12345',
        country: 'SA'
      },
      is_paying_customer: false,
      avatar_url: 'https://secure.gravatar.com/avatar/?s=96&d=mm&r=g',
      meta_data: []
    };

    const demoToken = 'demo_token_' + Math.random().toString(36).substr(2);

    return of({ user: demoUser, token: demoToken }).pipe(
      tap(response => {
        this._user.next(response.user);
        this._token.next(response.token);
        
        // Save to storage
        this.storage.set('user', response.user);
        this.storage.set('token', response.token);
      })
    );
  }

  // Register a new user
  register(userData: any): Observable<any> {
    // In a real application, this would connect to WooCommerce API
    // For demo purposes, we're using a simulated response
    const demoUser: User = {
      id: 999,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      email: userData.email,
      first_name: userData.firstName,
      last_name: userData.lastName,
      role: 'customer',
      username: userData.email,
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
      },
      is_paying_customer: false,
      avatar_url: 'https://secure.gravatar.com/avatar/?s=96&d=mm&r=g',
      meta_data: []
    };
    
    const demoToken = 'demo_token_' + Math.random().toString(36).substr(2);

    return of({ user: demoUser, token: demoToken }).pipe(
      tap(response => {
        this._user.next(response.user);
        this._token.next(response.token);
        
        // Save to storage
        this.storage.set('user', response.user);
        this.storage.set('token', response.token);
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
    // In a real application, this would connect to WooCommerce API
    // For demo purposes, we're simulating a success response
    const currentUser = this._user.value;
    
    if (!currentUser) {
      return throwError('User not logged in');
    }
    
    const updatedUser: User = {
      ...currentUser,
      ...userData
    };
    
    return of(updatedUser).pipe(
      tap(user => {
        this._user.next(user);
        this.storage.set('user', user);
      })
    );
  }

  // Reset password
  forgotPassword(email: string): Observable<any> {
    // In a real application, this would trigger a password reset email
    return of({ success: true, message: 'Password reset email sent.' });
  }
}