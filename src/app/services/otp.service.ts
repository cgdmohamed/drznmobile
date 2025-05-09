import { Injectable } from '@angular/core';
import { Observable, from, of, throwError, firstValueFrom } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { TaqnyatOtpService, WordPressOtpResponse } from './taqnyat-otp.service';

@Injectable({
  providedIn: 'root'
})
export class OtpService {
  private readonly OTP_STORAGE_KEY = 'otp_verification_data';
  private readonly PENDING_PHONE_KEY = 'pending_phone_verification';
  private readonly OTP_EXPIRATION_MINUTES = 10;

  constructor(
    private storage: Storage,
    private taqnyatOtpService: TaqnyatOtpService
  ) {}

  /**
   * Send OTP to a phone number using WordPress proxy for Taqnyat service
   * @param phoneNumber The phone number to send the OTP to
   */
  sendOtp(phoneNumber: string): Observable<any> {
    // Format the phone number as needed
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    // Save the phone number as pending verification
    this.storePendingPhone(formattedPhone);
    
    // Use WordPress proxy to send OTP
    return this.taqnyatOtpService.sendOtp(formattedPhone).pipe(
      tap(response => {
        console.log('OTP send response:', response);
        if (response.status === 'success') {
          // Store request ID for verification
          if (response.requestId) {
            this.storePendingRequestId(response.requestId);
          }
        }
      }),
      // Transform the response to a simpler format for backwards compatibility
      map(response => {
        if (response.status === 'success') {
          return {
            status: 'success',
            message: 'OTP sent successfully',
            messageId: response.requestId || ('msg_' + Math.random().toString(36).substring(2, 15))
          };
        } else {
          return {
            status: 'error',
            message: response.message,
            code: response.code
          };
        }
      }),
      catchError(error => {
        console.error('Error in OtpService.sendOtp:', error);
        return throwError(() => new Error('Failed to send verification code. Please try again later.'));
      })
    );
  }

  /**
   * Verify the OTP entered by the user
   * @param phoneNumber The phone number to verify
   * @param code The OTP code entered by the user
   */
  async verifyOtp(phoneNumber: string, code: string): Promise<WordPressOtpResponse> {
    try {
      // If no phone number provided, try to get the pending one
      const actualPhone = phoneNumber || await this.getPendingPhone();
      if (!actualPhone) {
        console.error('No phone number for verification');
        return {
          status: 'error',
          message: 'رقم الهاتف غير متوفر للتحقق من الرمز',
          code: 400
        };
      }
      
      // Verify with WordPress proxy using firstValueFrom instead of deprecated toPromise
      const response = await firstValueFrom(
        this.taqnyatOtpService.verifyOtp(actualPhone, code)
      );
      
      if (response.status === 'success') {
        console.log('OTP verified successfully');
        // Clear pending data
        await this.clearPendingData();
      } else {
        console.error('OTP verification failed:', response.message);
      }
      
      return response;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        status: 'error',
        message: typeof error === 'string' ? error : 'حدث خطأ أثناء التحقق من الرمز',
        code: 500
      };
    }
  }

  /**
   * Format phone number for Saudi Arabia
   * The WordPress proxy expects format with country code (966551234567)
   * 
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

  /**
   * Store the phone number that is pending verification
   */
  private async storePendingPhone(phoneNumber: string): Promise<void> {
    await this.storage.set(this.PENDING_PHONE_KEY, {
      phoneNumber,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get the pending phone number
   */
  private async getPendingPhone(): Promise<string | null> {
    const data = await this.storage.get(this.PENDING_PHONE_KEY);
    if (!data) return null;
    
    // Check if the pending verification is still valid (not expired)
    const timestamp = new Date(data.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
    
    if (diffMinutes > this.OTP_EXPIRATION_MINUTES) {
      console.warn('Pending phone verification expired');
      await this.clearPendingData();
      return null;
    }
    
    return data.phoneNumber;
  }

  /**
   * Store the request ID for verification
   */
  private async storePendingRequestId(requestId: string): Promise<void> {
    const data = await this.storage.get(this.PENDING_PHONE_KEY) || {};
    data.requestId = requestId;
    await this.storage.set(this.PENDING_PHONE_KEY, data);
  }

  /**
   * Get the stored request ID
   */
  private async getPendingRequestId(): Promise<string | null> {
    const data = await this.storage.get(this.PENDING_PHONE_KEY);
    return data && data.requestId ? data.requestId : null;
  }

  /**
   * Clear all pending verification data
   */
  private async clearPendingData(): Promise<void> {
    await this.storage.remove(this.PENDING_PHONE_KEY);
  }
}