import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Storage } from '@ionic/storage-angular';
import { EnvironmentService } from './environment.service';

export interface TaqnyatOtpResponse {
  code: number;
  message: string;
  status: 'success' | 'error';
  requestId?: string;
  expiresIn?: number;
}

export interface WordPressProxyRequest {
  phone: string;
  code?: string;
  requestId?: string;
  lang?: string;
  note?: string;
}

export interface WordPressProxyResponse {
  status: 'success' | 'error';
  message: string;
  requestId?: string;
  code?: number;
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
  private readonly RESULT_CODES = {
    CONNECTION_FAILED: 0,
    INVALID_API_KEY: 1,
    MOBILE_NUMBER_INCORRECT: 3,
    INSUFFICIENT_BALANCE: 4,
    ACTIVATION_CODE_SENT: 5,
    UNKNOWN_ERROR: 6,
    ALREADY_SENT: 7,
    EXCEEDED_ATTEMPTS: 8,
    ACTIVATION_SUCCESSFUL: 10,
    ACTIVATION_CODE_INCORRECT: 11,
    ATTEMPTS_EXHAUSTED: 12,
    NUMBER_ACTIVATED: 13
  };

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private environmentService: EnvironmentService
  ) {}

  /**
   * Send OTP to the provided phone number 
   * 
   * Uses WordPress proxy to Taqnyat API
   * 
   * @param phoneNumber The phone number to send the OTP to (must start with 966)
   * @param requestId Optional request ID for tracking purposes
   */
  sendOtp(phoneNumber: string, requestId?: string): Observable<TaqnyatOtpResponse> {
    // Format the phone number (ensure it starts with 966)
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    // If in development mode without a Taqnyat API key, use the demo mode
    if (!this.environmentService.isTaqnyatConfigured()) {
      console.warn('Taqnyat API key not configured, using demo mode');
      
      // In demo mode, generate a random 6-digit code and store it
      const verificationCode = this.generateOtpCode();
      this.storeOtpData(formattedNumber, verificationCode);
      
      console.log(`Demo Mode: OTP ${verificationCode} would be sent to ${formattedNumber}`);
      
      const response: TaqnyatOtpResponse = {
        code: this.RESULT_CODES.ACTIVATION_CODE_SENT,
        message: 'Activation code sent successfully (Demo Mode)',
        status: 'success',
        requestId: requestId || Math.random().toString(36).substring(2, 15),
        expiresIn: this.OTP_EXPIRATION_MINUTES * 60
      };
      
      return of(response);
    }
    
    // Prepare WordPress proxy request
    const proxyRequest: WordPressProxyRequest = {
      phone: formattedNumber,
      lang: 'ar',
      note: 'DRZN'
    };
    
    // Add request ID if provided
    if (requestId) {
      proxyRequest.requestId = requestId;
    }
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    // Call the WordPress proxy endpoint
    return this.http.post<WordPressProxyResponse>(this.wpSendOtpUrl, proxyRequest, { headers }).pipe(
      map(response => {
        // Map WordPress proxy response to our standard response format
        if (response.status === 'success') {
          // Store the verification data
          this.storeVerificationData(formattedNumber, response.requestId || '');
          
          const successResponse: TaqnyatOtpResponse = {
            code: this.RESULT_CODES.ACTIVATION_CODE_SENT,
            message: response.message,
            status: 'success',
            requestId: response.requestId,
            expiresIn: this.OTP_EXPIRATION_MINUTES * 60
          };
          
          return successResponse;
        } else {
          const errorResponse: TaqnyatOtpResponse = {
            code: response.code || this.RESULT_CODES.UNKNOWN_ERROR,
            message: response.message || this.getErrorMessageForCode(response.code || this.RESULT_CODES.UNKNOWN_ERROR),
            status: 'error'
          };
          
          return errorResponse;
        }
      }),
      catchError(error => {
        console.error('Error sending OTP via WordPress proxy:', error);
        
        if (environment.production) {
          return throwError(() => new Error('Failed to send verification code. Please try again later.'));
        } else {
          // In development, fall back to demo mode if API fails
          const verificationCode = this.generateOtpCode();
          this.storeOtpData(formattedNumber, verificationCode);
          
          console.log(`API Failed, Demo Fallback: OTP ${verificationCode} would be sent to ${formattedNumber}`);
          
          const fallbackResponse: TaqnyatOtpResponse = {
            code: this.RESULT_CODES.ACTIVATION_CODE_SENT,
            message: 'Activation code sent successfully (Demo Fallback)',
            status: 'success',
            requestId: requestId || Math.random().toString(36).substring(2, 15),
            expiresIn: this.OTP_EXPIRATION_MINUTES * 60
          };
          
          return of(fallbackResponse);
        }
      })
    );
  }

  /**
   * Verify the OTP entered by the user
   * 
   * Uses WordPress proxy to Taqnyat API
   * 
   * @param phoneNumber The phone number the OTP was sent to
   * @param otpCode The OTP code entered by the user
   * @param requestId Optional request ID used when sending the OTP
   */
  verifyOtp(phoneNumber: string, otpCode: string, requestId?: string): Observable<TaqnyatOtpResponse> {
    // Format the phone number
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    // For demo or development mode, verify against locally stored OTP
    if (!this.environmentService.isTaqnyatConfigured() || !environment.production) {
      return from(this.verifyLocalOtp(formattedNumber, otpCode)).pipe(
        map(isValid => {
          if (isValid) {
            const successResponse: TaqnyatOtpResponse = {
              code: this.RESULT_CODES.ACTIVATION_SUCCESSFUL,
              message: 'Activation process completed successfully.',
              status: 'success'
            };
            return successResponse;
          } else {
            const errorResponse: TaqnyatOtpResponse = {
              code: this.RESULT_CODES.ACTIVATION_CODE_INCORRECT,
              message: 'Activation code is incorrect.',
              status: 'error'
            };
            return errorResponse;
          }
        })
      );
    }
    
    // Prepare WordPress proxy request for verification
    const proxyRequest: WordPressProxyRequest = {
      phone: formattedNumber,
      code: otpCode
    };
    
    // Add request ID if provided
    if (requestId) {
      proxyRequest.requestId = requestId;
    } else {
      // Try to get request ID from stored data to add it to the request
      this.getStoredRequestId(formattedNumber).then(storedRequestId => {
        if (storedRequestId) {
          proxyRequest.requestId = storedRequestId;
        }
      });
    }
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    // Call the WordPress proxy endpoint
    return this.http.post<WordPressProxyResponse>(this.wpVerifyOtpUrl, proxyRequest, { headers }).pipe(
      map(response => {
        // Map WordPress proxy response to our standard response format
        if (response.status === 'success') {
          // Clear stored verification data on success
          this.clearStoredOtpData(formattedNumber);
          
          const successResponse: TaqnyatOtpResponse = {
            code: this.RESULT_CODES.ACTIVATION_SUCCESSFUL,
            message: response.message,
            status: 'success'
          };
          
          return successResponse;
        } else {
          const errorResponse: TaqnyatOtpResponse = {
            code: response.code || this.RESULT_CODES.UNKNOWN_ERROR,
            message: response.message || this.getErrorMessageForCode(response.code || this.RESULT_CODES.UNKNOWN_ERROR),
            status: 'error'
          };
          
          return errorResponse;
        }
      }),
      catchError(error => {
        console.error('Error verifying OTP via WordPress proxy:', error);
        
        if (environment.production) {
          return throwError(() => new Error('Failed to verify code. Please try again later.'));
        } else {
          // In development, fall back to local verification if API fails
          return from(this.verifyLocalOtp(formattedNumber, otpCode)).pipe(
            map(isValid => {
              if (isValid) {
                const successResponse: TaqnyatOtpResponse = {
                  code: this.RESULT_CODES.ACTIVATION_SUCCESSFUL,
                  message: 'Activation process completed successfully (Demo Fallback).',
                  status: 'success'
                };
                return successResponse;
              } else {
                const errorResponse: TaqnyatOtpResponse = {
                  code: this.RESULT_CODES.ACTIVATION_CODE_INCORRECT,
                  message: 'Activation code is incorrect (Demo Fallback).',
                  status: 'error'
                };
                return errorResponse;
              }
            })
          );
        }
      })
    );
  }

  /**
   * Generate a random 6-digit OTP code for demo/development mode
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
   * Store verification data for Taqnyat API (requestId, etc.)
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
   * Format phone number to E.164 format for Saudi Arabia
   * @param phone The phone number to format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let digits = phone.replace(/\D/g, '');
    
    // Remove country code (966) if present
    if (digits.startsWith('966')) {
      digits = digits.substring(3);
    }
    
    // Remove leading zero if present
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    
    // Return with Saudi country code
    return '966' + digits;
  }
  
  /**
   * Get a user-friendly error message for a Taqnyat result code
   */
  private getErrorMessageForCode(code: number): string {
    switch (code) {
      case this.RESULT_CODES.CONNECTION_FAILED:
        return 'Connection failed to Taqnyat server';
      case this.RESULT_CODES.INVALID_API_KEY:
        return 'Invalid API key';
      case this.RESULT_CODES.MOBILE_NUMBER_INCORRECT:
        return 'Mobile number is not specified or incorrect';
      case this.RESULT_CODES.INSUFFICIENT_BALANCE:
        return 'Your balance is not enough';
      case this.RESULT_CODES.ACTIVATION_CODE_SENT:
        return 'Activation code sent successfully';
      case this.RESULT_CODES.UNKNOWN_ERROR:
        return 'Unknown error, please contact technical support';
      case this.RESULT_CODES.ALREADY_SENT:
        return 'The activation code has already been sent, you can re-send it shortly';
      case this.RESULT_CODES.EXCEEDED_ATTEMPTS:
        return 'You have exceeded the allowed number of attempts';
      case this.RESULT_CODES.ACTIVATION_SUCCESSFUL:
        return 'Activation process completed successfully';
      case this.RESULT_CODES.ACTIVATION_CODE_INCORRECT:
        return 'Activation code is incorrect';
      case this.RESULT_CODES.ATTEMPTS_EXHAUSTED:
        return 'Attempts to enter activation code have been exhausted';
      case this.RESULT_CODES.NUMBER_ACTIVATED:
        return 'This number is already activated';
      default:
        return `Unknown error code: ${code}`;
    }
  }
}