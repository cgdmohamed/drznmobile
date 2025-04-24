import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Registration response interface
 */
export interface RegisterResponse {
  success: boolean;
  message?: string;
  data?: {
    user_id?: number;
    username?: string;
    email?: string;
  };
  error?: string;
}

/**
 * OTP verification response interface
 */
export interface OtpResponse {
  success: boolean;
  data?: {
    message?: string;
    verification_id?: string;
  };
  error?: string;
}

/**
 * Password reset response interface
 */
export interface PasswordResetResponse {
  success: boolean;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private apiUrl = environment.apiUrl;
  private jwtRegisterEndpoint = `${this.apiUrl}/wp-json/simple-jwt-login/v1/users`;
  private authCode = environment.jwtAuthCode || '';

  constructor(private http: HttpClient) {}

  /**
   * Register a new user
   * @param userData User registration data
   */
  register(userData: {
    email: string;
    password: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    meta_data?: {key: string, value: any}[];
  }): Observable<RegisterResponse> {
    const registerData = {
      ...userData,
      AUTH_CODE: this.authCode
    };

    return this.http.post<RegisterResponse>(this.jwtRegisterEndpoint, registerData).pipe(
      tap(response => {
        if (response.success) {
          console.log('User registration successful', response);
        }
      }),
      catchError(error => {
        console.error('Registration error', error);
        return throwError(() => new Error(error.error?.error || 'Registration failed. Please try again.'));
      })
    );
  }

  /**
   * Request password reset via email
   * @param email User's email address
   */
  requestPasswordReset(email: string): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(`${this.jwtRegisterEndpoint}/reset-password`, {
      email: email,
      AUTH_CODE: this.authCode
    }).pipe(
      catchError(error => {
        console.error('Password reset request error', error);
        return throwError(() => new Error(error.error?.error || 'Unable to request password reset. Please try again.'));
      })
    );
  }

  /**
   * Reset password with reset key (from email)
   * @param key Reset key from email
   * @param password New password
   */
  resetPassword(key: string, password: string): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(`${this.jwtRegisterEndpoint}/reset-password`, {
      key: key,
      password: password,
      AUTH_CODE: this.authCode
    }).pipe(
      catchError(error => {
        console.error('Password reset error', error);
        return throwError(() => new Error(error.error?.error || 'Password reset failed. Please try again.'));
      })
    );
  }

  /**
   * Delete a user (only accessible by admin users)
   * @param userId User ID to delete
   * @param jwt Admin JWT token
   */
  deleteUser(userId: number, jwt: string): Observable<any> {
    return this.http.delete(`${this.jwtRegisterEndpoint}/${userId}`, {
      body: {
        jwt: jwt,
        AUTH_CODE: this.authCode
      }
    }).pipe(
      catchError(error => {
        console.error('Delete user error', error);
        return throwError(() => new Error(error.error?.error || 'Unable to delete user.'));
      })
    );
  }

  /**
   * Verify OTP (One-Time Password) for mobile verification
   * This integrates with Taqnyat SMS service
   * @param mobile Mobile number including country code (e.g., +966501234567)
   * @param otp OTP code received via SMS
   * @param verificationId Verification ID received from sendOtp
   */
  verifyOtp(mobile: string, otp: string, verificationId: string): Observable<OtpResponse> {
    return this.http.post<OtpResponse>(`${this.apiUrl}/wp-json/custom/v1/verify-otp`, {
      mobile: mobile,
      otp: otp,
      verification_id: verificationId
    }).pipe(
      catchError(error => {
        console.error('OTP verification error', error);
        return throwError(() => new Error(error.error?.error || 'OTP verification failed. Please try again.'));
      })
    );
  }

  /**
   * Send OTP (One-Time Password) for mobile verification
   * This integrates with Taqnyat SMS service
   * @param mobile Mobile number including country code (e.g., +966501234567)
   */
  sendOtp(mobile: string): Observable<OtpResponse> {
    return this.http.post<OtpResponse>(`${this.apiUrl}/wp-json/custom/v1/send-otp`, {
      mobile: mobile
    }).pipe(
      catchError(error => {
        console.error('Send OTP error', error);
        return throwError(() => new Error(error.error?.error || 'Unable to send OTP. Please try again.'));
      })
    );
  }
}