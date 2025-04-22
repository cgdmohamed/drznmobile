import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OtpService {
  private apiUrl = 'https://api.taqnyat.sa';
  private apiKey = environment.taqnyatApiKey;
  private sender = 'DARZN';
  private tempVerificationCode: string; // For demo without actual API

  constructor(private http: HttpClient) {}

  // Send OTP to a phone number
  sendOtp(phoneNumber: string): Observable<any> {
    // Format the phone number
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    // Set a fixed 4-digit OTP code for testing purposes
    this.tempVerificationCode = '1234';
    
    // In a real application, this would make an API call to Taqnyat.sa
    // const endpoint = `${this.apiUrl}/v1/messages`;
    // const body = {
    //   sender: this.sender,
    //   recipients: [formattedNumber],
    //   body: `Your DARZN verification code is: ${this.tempVerificationCode}. Valid for 10 minutes.`
    // };
    // const headers = {
    //   'Authorization': `Bearer ${this.apiKey}`,
    //   'Content-Type': 'application/json'
    // };
    // return this.http.post(endpoint, body, { headers });
    
    // For demo purposes, simulate a successful SMS sent response
    console.log(`Demo: OTP ${this.tempVerificationCode} would be sent to ${formattedNumber}`);
    return of({
      status: 'success',
      message: 'OTP sent successfully (Use code: 1234 for testing)',
      messageId: 'msg_' + Math.random().toString(36).substring(2, 15)
    });
  }

  // Verify the OTP entered by the user
  verifyOtp(code: string): boolean {
    // In a real application, verification would be done via API
    // This is a simple check for demo purposes
    console.log(`Verifying OTP: Entered=${code}, Stored=${this.tempVerificationCode}`);
    
    // For testing purposes in development, accept any 4-digit code
    return code.length === 4 && /^\d{4}$/.test(code);
  }

  // Format phone number to international format
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