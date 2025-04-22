import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ToastController, LoadingController } from '@ionic/angular';
import { Cart } from '../interfaces/cart.interface';

// Make TypeScript aware of global objects
declare const Moyasar: any;
declare global {
  interface Window {
    ApplePaySession?: any;
  }
}

export interface PaymentResult {
  success: boolean;
  message: string;
  transactionId?: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private moyasarPublishableKey = environment.moyasarPublishableKey;
  private _paymentResult = new BehaviorSubject<PaymentResult | null>(null);
  
  constructor(
    private http: HttpClient,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}
  
  /**
   * Initialize Moyasar in component where it's needed
   */
  initializeMoyasar() {
    if (typeof Moyasar === 'undefined') {
      // Load Moyasar script if not already loaded
      const script = document.createElement('script');
      script.src = 'https://cdn.moyasar.com/mpf/1.7.3/moyasar.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }
  
  /**
   * Get payment result as an observable
   */
  get paymentResult(): Observable<PaymentResult | null> {
    return this._paymentResult.asObservable();
  }
  
  /**
   * Process a credit card payment using Moyasar
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  async processCreditCardPayment(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    const loading = await this.loadingController.create({
      message: 'Processing payment...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // Initialize the payment form
      const moyasar = new Moyasar(this.moyasarPublishableKey);
      
      // Create payment form
      const form = moyasar.createForm({
        amount: Math.round(cart.total * 100), // Convert to smallest currency unit (piasters)
        currency: 'SAR',
        description: `Order from DARZN App (${cart.items.length} items)`,
        callback_url: 'https://example.com/payment/callback', // This should be your server endpoint
        metadata: {
          order_id: `ORDER-${Date.now()}`,
          customer_email: billingDetails.email,
          customer_name: `${billingDetails.first_name} ${billingDetails.last_name}`
        }
      }, {
        saveCardOption: false,
        locale: 'ar',
        appearance: {
          direction: 'rtl',
          element: {
            base: {
              color: '#32325d',
              fontFamily: 'Tajawal, sans-serif',
              fontSmoothing: 'antialiased',
              fontSize: '16px',
              '::placeholder': {
                color: '#aab7c4'
              }
            },
            invalid: {
              color: '#fa755a',
              iconColor: '#fa755a'
            }
          }
        }
      });
      
      // Handle form submission and payment
      const result = await new Promise<PaymentResult>((resolve) => {
        form.mount('.moyasar-payment-form');
        
        form.on('completed', (payment: any) => {
          const paymentResult: PaymentResult = {
            success: true,
            message: 'Payment completed successfully',
            transactionId: payment.id,
            data: payment
          };
          
          this._paymentResult.next(paymentResult);
          resolve(paymentResult);
        });
        
        form.on('failed', (error: any) => {
          const paymentResult: PaymentResult = {
            success: false,
            message: error.message || 'Payment failed',
            data: error
          };
          
          this._paymentResult.next(paymentResult);
          resolve(paymentResult);
        });
      });
      
      await loading.dismiss();
      return result;
    } catch (error) {
      await loading.dismiss();
      console.error('Payment error:', error);
      
      const errorResult: PaymentResult = {
        success: false,
        message: 'An error occurred during payment processing',
        data: error
      };
      
      this._paymentResult.next(errorResult);
      this.presentErrorToast(errorResult.message);
      return errorResult;
    }
  }
  
  /**
   * Check if Apple Pay is supported on the device
   */
  isApplePaySupported(): boolean {
    // Check if we're in a browser that supports Apple Pay
    return !!(window.ApplePaySession && window.ApplePaySession.canMakePayments);
  }

  /**
   * Process Apple Pay payment
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  async processApplePay(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    // Check if Apple Pay is available
    if (!this.isApplePaySupported()) {
      const errorResult: PaymentResult = {
        success: false,
        message: 'Apple Pay is not available on this device',
      };
      
      this._paymentResult.next(errorResult);
      this.presentErrorToast(errorResult.message);
      return errorResult;
    }
    
    const loading = await this.loadingController.create({
      message: 'Initializing Apple Pay...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // Initialize the payment request
      const paymentRequest = {
        countryCode: 'SA',
        currencyCode: 'SAR',
        supportedNetworks: ['visa', 'masterCard', 'mada'],
        merchantCapabilities: ['supports3DS'],
        total: {
          label: 'DARZN App',
          amount: cart.total
        },
        lineItems: cart.items.map(item => ({
          label: item.product.name,
          amount: parseFloat(item.product.price) * item.quantity
        }))
      };
      
      // Create Apple Pay session
      const session = new window.ApplePaySession(3, paymentRequest);
      
      // Handle validation
      session.onvalidatemerchant = async (event: any) => {
        try {
          // This would normally call your server to validate the merchant
          // For demo purposes, we'll simulate success
          session.completeMerchantValidation({});
        } catch (error) {
          session.abort();
          console.error('Merchant validation failed:', error);
        }
      };
      
      // Handle payment authorization
      session.onpaymentauthorized = async (event: any) => {
        try {
          // This would normally call your server to process the payment
          // For demo purposes, we'll simulate success
          
          session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
          
          const paymentResult: PaymentResult = {
            success: true,
            message: 'Apple Pay payment completed successfully',
            transactionId: `AP-${Date.now()}`,
            data: event.payment
          };
          
          this._paymentResult.next(paymentResult);
          await loading.dismiss();
          this.presentSuccessToast('Payment successful');
          
          return paymentResult;
        } catch (error) {
          session.completePayment(window.ApplePaySession.STATUS_FAILURE);
          console.error('Payment processing failed:', error);
          
          const errorResult: PaymentResult = {
            success: false,
            message: 'Apple Pay payment failed',
            data: error
          };
          
          this._paymentResult.next(errorResult);
          await loading.dismiss();
          this.presentErrorToast(errorResult.message);
          
          return errorResult;
        }
      };
      
      // Start the session
      session.begin();
      
      await loading.dismiss();
      
      // Return a placeholder result since the actual result will be handled in the session events
      return {
        success: true,
        message: 'Apple Pay session started'
      };
    } catch (error) {
      await loading.dismiss();
      console.error('Apple Pay error:', error);
      
      const errorResult: PaymentResult = {
        success: false,
        message: 'An error occurred initializing Apple Pay',
        data: error
      };
      
      this._paymentResult.next(errorResult);
      this.presentErrorToast(errorResult.message);
      return errorResult;
    }
  }
  
  /**
   * Process Apple Pay payment (backward compatibility for existing components)
   * @param amount The amount to charge
   * @param description The payment description
   */
  processApplePayPayment(amount: number, description: string): Promise<PaymentResult> {
    // Create a minimal cart and billing details
    const cart: Cart = {
      items: [],
      itemCount: 1,
      subtotal: amount,
      discount: 0,
      shipping: 0,
      vat: 0,
      total: amount
    };
    
    const billingDetails = {
      email: 'customer@example.com',
      first_name: 'Customer',
      last_name: 'Name'
    };
    
    return this.processApplePay(cart, billingDetails);
  }
  
  /**
   * Verify payment status (for integration with existing code)
   * @param paymentId The payment ID to verify
   */
  verifyPayment(paymentId: string): Observable<any> {
    // Simulate verification with the payment gateway
    return of({
      status: 'paid',
      id: paymentId,
      message: 'Payment verified successfully'
    });
  }
  
  /**
   * Process Cash on Delivery
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  processCashOnDelivery(cart: Cart, billingDetails: any): PaymentResult {
    const result: PaymentResult = {
      success: true,
      message: 'Order placed successfully with Cash on Delivery',
      transactionId: `COD-${Date.now()}`
    };
    
    this._paymentResult.next(result);
    this.presentSuccessToast(result.message);
    return result;
  }
  
  /**
   * Process STCPay payment
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  async processSTCPay(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    const loading = await this.loadingController.create({
      message: 'Processing STC Pay...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // In a real implementation, you would integrate with the STC Pay API
      // For this example, we'll simulate a successful payment
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result: PaymentResult = {
        success: true,
        message: 'STC Pay payment completed successfully',
        transactionId: `STC-${Date.now()}`
      };
      
      this._paymentResult.next(result);
      await loading.dismiss();
      this.presentSuccessToast(result.message);
      return result;
    } catch (error) {
      await loading.dismiss();
      console.error('STC Pay error:', error);
      
      const errorResult: PaymentResult = {
        success: false,
        message: 'An error occurred processing STC Pay payment',
        data: error
      };
      
      this._paymentResult.next(errorResult);
      this.presentErrorToast(errorResult.message);
      return errorResult;
    }
  }
  
  /**
   * Present a success toast message
   * @param message The message to display
   */
  private async presentSuccessToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'success'
    });
    
    await toast.present();
  }
  
  /**
   * Present an error toast message
   * @param message The message to display
   */
  private async presentErrorToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    
    await toast.present();
  }
}