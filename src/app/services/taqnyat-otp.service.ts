import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Storage } from '@ionic/storage-angular';
import { EnvironmentService } from './environment.service';

export interface WordPressOtpResponse {
  status: 'success' | 'error';
  message: string;
  requestId?: string;
  code?: number;
}

export interface WordPressOtpRequest {
  phone: string;
  code?: string;
  requestId?: string;
  lang?: string;
  note?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaqnyatOtpService {
  // WordPress proxy endpoints
  private wpSendOtpUrl = environment.wordpressUrl + '/wp-json/taqnyat/v1/send-otp';
  private wpVerifyOtpUrl = environment.wordpressUrl + '/wp-json/taqnyat/v1/verify-otp';
  
  private readonly OTP_STORAGE_KEY = 'taqnyat_otp_data';
  private readonly OTP_EXPIRATION_MINUTES = 10;

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private environmentService: EnvironmentService
  ) {}

  /**
   * Send OTP to the provided phone number 
   * Uses WordPress proxy API
   * 
   * @param phoneNumber The phone number to send the OTP to
   */
  sendOtp(phoneNumber: string): Observable<WordPressOtpResponse> {
    // Format the phone number (ensure it's in local format for WordPress API)
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    // Prepare WordPress proxy request
    const proxyRequest: WordPressOtpRequest = {
      phone: formattedNumber,
      lang: 'ar',
      note: 'DRZN'
    };
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    // Call the WordPress proxy endpoint
    return this.http.post<WordPressOtpResponse>(this.wpSendOtpUrl, proxyRequest, { headers }).pipe(
      map(response => {
        // Store the verification requestId if successful
        if (response.status === 'success' && response.requestId) {
          this.storeVerificationData(formattedNumber, response.requestId);
        }
        
        return response;
      }),
      catchError(error => {
        console.error('Error sending OTP via WordPress proxy:', error);
        
        if (environment.production) {
          return throwError(() => new Error('فشل في إرسال رمز التحقق. يرجى المحاولة مرة أخرى.'));
        } else {
          // In development, fall back to demo mode if API fails
          const verificationCode = this.generateOtpCode();
          this.storeOtpData(formattedNumber, verificationCode);
          
          console.log(`API Failed, Demo Fallback: OTP ${verificationCode} would be sent to ${formattedNumber}`);
          
          const fallbackResponse: WordPressOtpResponse = {
            status: 'success',
            message: 'تم إرسال رمز التحقق (وضع التطوير)',
            requestId: Math.random().toString(36).substring(2, 15)
          };
          
          return of(fallbackResponse);
        }
      })
    );
  }

  /**
   * Verify the OTP entered by the user
   * Uses WordPress proxy API
   * 
   * @param phoneNumber The phone number the OTP was sent to
   * @param otpCode The OTP code entered by the user
   */
  verifyOtp(phoneNumber: string, otpCode: string): Observable<WordPressOtpResponse> {
    // Format the phone number
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    // Prepare WordPress proxy request for verification
    const proxyRequest: WordPressOtpRequest = {
      phone: formattedNumber,
      code: otpCode
    };
    
    // Try to get request ID from stored data to add it to the request
    return from(this.getStoredRequestId(formattedNumber)).pipe(
      map(requestId => {
        if (requestId) {
          proxyRequest.requestId = requestId;
        }
        return proxyRequest;
      }),
      switchMap(request => {
        const headers = new HttpHeaders({
          'Content-Type': 'application/json'
        });
        
        // Call the WordPress proxy endpoint
        return this.http.post<WordPressOtpResponse>(this.wpVerifyOtpUrl, request, { headers }).pipe(
          map(response => {
            // Clear stored verification data on success
            if (response.status === 'success') {
              this.clearStoredOtpData(formattedNumber);
            }
            
            return response;
          }),
          catchError(error => {
            console.error('Error verifying OTP via WordPress proxy:', error);
            
            if (environment.production) {
              return throwError(() => new Error('فشل في التحقق من الرمز. يرجى المحاولة مرة أخرى.'));
            } else {
              // In development, fall back to local verification if API fails
              return from(this.verifyLocalOtp(formattedNumber, otpCode)).pipe(
                map(isValid => {
                  if (isValid) {
                    const successResponse: WordPressOtpResponse = {
                      status: 'success',
                      message: 'تم التحقق بنجاح (وضع التطوير)'
                    };
                    return successResponse;
                  } else {
                    const errorResponse: WordPressOtpResponse = {
                      status: 'error',
                      message: 'رمز التحقق غير صحيح (وضع التطوير)',
                      code: 0
                    };
                    return errorResponse;
                  }
                })
              );
            }
          })
        );
      })
    );
  }

  /**
   * Generate a random 4-digit OTP code for demo/development mode
   */
  private generateOtpCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  
  /**
   * Store OTP data for local verification (used in demo/development mode)
   */
  private async storeOtpData(phoneNumber: string, code: string): Promise<void> {
    // Calculate expiration time (10 minutes from now)
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + this.OTP_EXPIRATION_MINUTES);
    
    const otpData = {
      phoneNumber,
      code,
      expirationTime: expirationTime.toISOString(),
      createdAt: new Date().toISOString()
    };
    
    // Get existing data
    const existingData = await this.storage.get(this.OTP_STORAGE_KEY) || {};
    
    // Update with new data for this phone number
    existingData[phoneNumber] = otpData;
    
    await this.storage.set(this.OTP_STORAGE_KEY, existingData);
  }
  
  /**
   * Store verification data for WordPress API (requestId, etc.)
   */
  private async storeVerificationData(phoneNumber: string, requestId: string): Promise<void> {
    // Get existing data
    const existingData = await this.storage.get(this.OTP_STORAGE_KEY) || {};
    
    // Update with verification data
    existingData[phoneNumber] = {
      phoneNumber,
      requestId,
      createdAt: new Date().toISOString()
    };
    
    await this.storage.set(this.OTP_STORAGE_KEY, existingData);
  }
  
  /**
   * Verify OTP locally (used in demo/development mode)
   */
  private async verifyLocalOtp(phoneNumber: string, code: string): Promise<boolean> {
    // Get stored OTP data
    const allOtpData = await this.storage.get(this.OTP_STORAGE_KEY) || {};
    const otpData = allOtpData[phoneNumber];
    
    if (!otpData) {
      console.error('No OTP data found for phone number:', phoneNumber);
      return false;
    }
    
    // Check if we have the code (demo mode) or just requestId (real API mode)
    if (!otpData.code) {
      console.error('No code found in OTP data, cannot verify locally');
      return false;
    }
    
    const now = new Date();
    const expirationTime = otpData.expirationTime ? new Date(otpData.expirationTime) : null;
    
    // Check if OTP has expired
    if (expirationTime && now > expirationTime) {
      console.error('OTP expired');
      this.clearStoredOtpData(phoneNumber);
      return false;
    }
    
    // Verify the code
    const isValid = code === otpData.code;
    
    console.log(`Verifying OTP: Entered=${code}, Stored=${otpData.code}, Valid=${isValid}`);
    
    // If valid, clear the stored OTP data
    if (isValid) {
      this.clearStoredOtpData(phoneNumber);
    }
    
    return isValid;
  }
  
  /**
   * Get stored request ID for a phone number
   */
  private async getStoredRequestId(phoneNumber: string): Promise<string | null> {
    const allOtpData = await this.storage.get(this.OTP_STORAGE_KEY) || {};
    const otpData = allOtpData[phoneNumber];
    
    return otpData && otpData.requestId ? otpData.requestId : null;
  }
  
  /**
   * Clear stored OTP data for a phone number
   */
  private async clearStoredOtpData(phoneNumber: string): Promise<void> {
    const allOtpData = await this.storage.get(this.OTP_STORAGE_KEY) || {};
    
    if (allOtpData[phoneNumber]) {
      delete allOtpData[phoneNumber];
      await this.storage.set(this.OTP_STORAGE_KEY, allOtpData);
    }
  }

  /**
   * Format phone number for WordPress API
   * The API expects format with country code (e.g., 966551234567)
   * @param phone The phone number to format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let digits = phone.replace(/\D/g, '');
    
    // If already has country code, leave it
    if (digits.startsWith('966')) {
      return digits;
    }
    
    // Remove leading zero if present
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    
    // Add Saudi country code
    return '966' + digits;
  }
}