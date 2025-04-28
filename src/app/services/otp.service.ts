import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Storage } from '@ionic/storage-angular';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class OtpService {
  private apiUrl = '/taqnyat-api';
  private sender = 'DARZN';
  private readonly OTP_STORAGE_KEY = 'otp_verification_data';
  private readonly OTP_EXPIRATION_MINUTES = 10;

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private environmentService: EnvironmentService
  ) {}

  // Send OTP to a phone number
  sendOtp(phoneNumber: string): Observable<any> {
    // Format the phone number
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    // Generate a random 4-digit OTP
    const verificationCode = this.generateOtpCode();
    
    // Store the OTP and its expiration time
    this.storeOtpData(formattedNumber, verificationCode);
    
    if (!this.environmentService.isTaqnyatConfigured()) {
      console.error('Taqnyat API key not configured');
      return throwError(() => new Error('SMS verification service is not available. Please contact support.'));
    }
    
    // Implementation using Taqnyat.sa API
    const endpoint = `${this.apiUrl}/v1/messages`;
    const body = {
      sender: this.sender,
      recipients: [formattedNumber],
      body: `Your DARZN verification code is: ${verificationCode}. Valid for ${this.OTP_EXPIRATION_MINUTES} minutes.`
    };
    const headers = {
      'Authorization': `Bearer ${this.environmentService.taqnyatApiKey}`,
      'Content-Type': 'application/json'
    };
    
    return this.http.post(endpoint, body, { headers }).pipe(
      tap(response => console.log('Taqnyat API response:', response)),
      catchError(error => {
        console.error('Error sending OTP via Taqnyat API:', error);
        return throwError(() => new Error('Failed to send verification code. Please try again later.'));
      })
    );
  }

  // Verify the OTP entered by the user
  async verifyOtp(code: string): Promise<boolean> {
    // Get the stored OTP data
    const otpData = await this.storage.get(this.OTP_STORAGE_KEY);
    
    if (!otpData) {
      console.error('No OTP data found');
      return false;
    }
    
    const now = new Date();
    const expirationTime = new Date(otpData.expirationTime);
    
    // Check if OTP has expired
    if (now > expirationTime) {
      console.error('OTP expired');
      await this.storage.remove(this.OTP_STORAGE_KEY);
      return false;
    }
    
    // Verify the code
    const isValid = code === otpData.code;
    
    console.log(`Verifying OTP: Entered=${code}, Stored=${otpData.code}, Valid=${isValid}`);
    
    // If valid, clear the stored OTP data
    if (isValid) {
      await this.storage.remove(this.OTP_STORAGE_KEY);
    }
    
    return isValid;
  }

  // Generate a random 4-digit OTP code
  private generateOtpCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  
  // Store OTP data with expiration
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
    
    await this.storage.set(this.OTP_STORAGE_KEY, otpData);
  }

  // Format phone number to international format for Saudi Arabia
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If the number doesn't start with '+', add Saudi Arabia country code
    if (!phoneNumber.startsWith('+')) {
      // If it starts with '0', remove it
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      
      // Add Saudi Arabia country code (+966)
      cleaned = '966' + cleaned;
    }
    
    return cleaned;
  }
}