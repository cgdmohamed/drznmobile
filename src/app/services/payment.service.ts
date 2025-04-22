import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Platform } from '@ionic/angular';
import { environment } from '../../environments/environment';

/**
 * PaymentService for Moyasar integration
 * 
 * This service handles all payment operations through Moyasar payment gateway.
 * It supports both credit card payments and Apple Pay for iOS devices.
 * 
 * Configuration:
 * - Add your Moyasar publishable key to environment.moyasarPublishableKey
 * - For production use live keys, for testing use test keys (starting with "test_")
 * 
 * API Documentation: https://moyasar.com/docs
 */
@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = 'https://api.moyasar.com/v1';
  private publishableKey = environment.moyasarPublishableKey;
  private isApplePayAvailable = false;

  constructor(
    private http: HttpClient,
    private platform: Platform
  ) {
    console.log('Payment Service initialized with key:', this.publishableKey ? 'Key is set' : 'Key is missing');
    // Check if Apple Pay is available on this device
    this.checkApplePayAvailability();
  }

  /**
   * Checks if Apple Pay is available on the current iOS device
   */
  private checkApplePayAvailability(): void {
    if (this.platform.is('ios')) {
      if ((window as any).ApplePaySession && (window as any).ApplePaySession.canMakePayments()) {
        this.isApplePayAvailable = true;
        console.log('Apple Pay is available on this device');
      } else {
        console.log('Apple Pay is not available on this device');
      }
    }
  }

  /**
   * Returns true if Apple Pay is available on this device
   */
  isApplePaySupported(): boolean {
    return this.isApplePayAvailable;
  }

  /**
   * Get the Moyasar publishable key
   */
  getPublishableKey(): string {
    return this.publishableKey;
  }

  // Process a payment with card data (direct API call method - not used with form)
  processPayment(amount: number, cardData: any, description: string = 'DARZN Order Payment'): Observable<any> {
    // Structure the payment data
    const paymentData = {
      amount: amount * 100, // Amount in halalas
      currency: 'SAR',
      description: description,
      source: {
        type: 'creditcard',
        name: cardData.name,
        number: cardData.number,
        cvc: cardData.cvc,
        month: cardData.month,
        year: cardData.year
      },
      callback_url: window.location.origin + '/checkout'
    };

    // For a real implementation, we would call the Moyasar API
    return this.http.post(`${this.apiUrl}/payments`, paymentData, {
      headers: {
        'Authorization': `Basic ${btoa(this.publishableKey + ':')}`
      }
    });
  }

  // Get payment status by ID
  getPaymentStatus(paymentId: string): Observable<any> {
    // For a real implementation:
    return this.http.get(`${this.apiUrl}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Basic ${btoa(this.publishableKey + ':')}`
      }
    });
  }

  // Handle the 3D secure verification if needed
  verifyPayment(paymentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Basic ${btoa(this.publishableKey + ':')}`
      }
    });
  }

  // Verify a payment source
  verifyPaymentSource(source: any): Observable<any> {
    // Check if there's a transaction_url
    if (source && source.transaction_url) {
      return this.http.get(source.transaction_url, {
        headers: {
          'Authorization': `Basic ${btoa(this.publishableKey + ':')}`
        }
      });
    }
    return of({
      status: 'failed',
      message: 'No transaction URL found'
    });
  }

  // Create a payment
  createPayment(paymentData: any): Observable<any> {
    // Format payment data for Moyasar API
    const moyasarPaymentData = {
      amount: paymentData.amount * 100, // Convert to halalas
      currency: 'SAR',
      description: paymentData.description || 'DARZN Order Payment',
      source: paymentData.source,
      callback_url: window.location.origin + '/checkout'
    };

    return this.http.post(`${this.apiUrl}/payments`, moyasarPaymentData, {
      headers: {
        'Authorization': `Basic ${btoa(this.publishableKey + ':')}`
      }
    });
  }
  
  /**
   * Process payment using Apple Pay
   * @param amount - Amount to charge (in SAR)
   * @param description - Payment description
   * @returns Observable with payment result
   */
  processApplePayPayment(amount: number, description: string = 'DARZN Order Payment'): Observable<any> {
    if (!this.isApplePayAvailable) {
      return of({
        success: false,
        message: 'Apple Pay is not available on this device'
      });
    }
    
    // Convert amount to smallest currency unit (halalas for SAR)
    const amountInHalalas = Math.round(amount * 100);
    
    // Create Apple Pay payment request
    const paymentRequest = {
      countryCode: 'SA',
      currencyCode: 'SAR',
      supportedNetworks: ['amex', 'masterCard', 'visa'],
      merchantCapabilities: ['supports3DS'],
      total: {
        label: 'DARZN Store',
        amount: amount.toFixed(2)
      }
    };
    
    try {
      // Create Apple Pay session
      const session = new (window as any).ApplePaySession(3, paymentRequest);
      
      // Handle payment authorization
      session.onpaymentauthorized = (event: any) => {
        // Get payment token
        const token = event.payment.token;
        
        // Process payment with Moyasar using the token
        const paymentData = {
          amount: amountInHalalas,
          currency: 'SAR',
          description: description,
          source: {
            type: 'applepay',
            token: JSON.stringify(token.paymentData)
          },
          callback_url: window.location.origin + '/checkout'
        };
        
        // Call Moyasar API
        this.http.post(`${this.apiUrl}/payments`, paymentData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(this.publishableKey + ':')}`
          }
        }).subscribe(
          (response: any) => {
            if (response.status === 'paid') {
              // Complete Apple Pay session with success
              session.completePayment({
                status: (window as any).ApplePaySession.STATUS_SUCCESS
              });
            } else {
              // Complete Apple Pay session with failure
              session.completePayment({
                status: (window as any).ApplePaySession.STATUS_FAILURE
              });
            }
          },
          (error) => {
            console.error('Apple Pay payment failed:', error);
            // Complete Apple Pay session with failure
            session.completePayment({
              status: (window as any).ApplePaySession.STATUS_FAILURE
            });
          }
        );
      };
      
      // Start Apple Pay session
      session.begin();
      
      // Return a placeholder observable
      return of({ initiated: true });
    } catch (error) {
      console.error('Error initiating Apple Pay:', error);
      return of({
        success: false,
        message: 'Error initiating Apple Pay',
        error: error
      });
    }
  }
}