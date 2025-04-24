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
   * Process Apple Pay payment according to Moyasar guidelines
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  async processApplePay(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    // Check if Apple Pay is available
    if (!this.isApplePaySupported()) {
      const errorResult: PaymentResult = {
        success: false,
        message: 'Apple Pay غير متوفر على هذا الجهاز',
      };
      
      this._paymentResult.next(errorResult);
      this.presentErrorToast(errorResult.message);
      return errorResult;
    }
    
    const loading = await this.loadingController.create({
      message: 'جاري تجهيز Apple Pay...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // Initialize Moyasar
      if (typeof Moyasar === 'undefined') {
        // Load Moyasar script if not already loaded
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.moyasar.com/mpf/1.7.3/moyasar.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = (e) => reject(e);
          document.body.appendChild(script);
        });
      }
      
      // Create payment object for Moyasar Apple Pay
      const moyasar = new Moyasar(this.moyasarPublishableKey);
      
      // Configure Apple Pay payment options
      const applePayOptions = {
        amount: Math.round(cart.total * 100), // Convert to smallest currency unit (halalas)
        currency: 'SAR',
        description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
        callback_url: window.location.origin + '/checkout/confirmation',
        metadata: {
          order_id: `ORDER-${Date.now()}`,
          customer_email: billingDetails.email || 'customer@example.com',
          customer_name: `${billingDetails.first_name || ''} ${billingDetails.last_name || ''}`.trim()
        },
        apple_pay: {
          country: 'SA',
          label: 'DARZN متجر',
          validate_merchant_url: 'https://api.moyasar.com/v1/applepay/validate',
        }
      };
      
      // Create Apple Pay payment request
      const paymentRequest = {
        countryCode: 'SA',
        currencyCode: 'SAR',
        supportedNetworks: ['visa', 'masterCard', 'mada'],
        merchantCapabilities: ['supports3DS', 'supportsDebit', 'supportsCredit'],
        total: {
          label: 'DARZN متجر',
          amount: cart.total, // Actual amount to charge
          type: 'final'
        },
        lineItems: cart.items.map(item => ({
          label: item.product.name,
          amount: parseFloat(item.product.price) * item.quantity,
          type: 'final'
        }))
      };
      
      // Create Apple Pay session
      const session = new window.ApplePaySession(6, paymentRequest); // Version 6 supports more features
      
      // Set up Apple Pay session event handlers
      session.onvalidatemerchant = async (event: any) => {
        try {
          // Call Moyasar's validation endpoint
          const response = await fetch('https://api.moyasar.com/v1/applepay/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${btoa(this.moyasarPublishableKey + ':')}`
            },
            body: JSON.stringify({
              validation_url: event.validationURL,
              domain: window.location.hostname
            })
          });
          
          if (!response.ok) {
            throw new Error('Merchant validation failed');
          }
          
          const merchantSession = await response.json();
          session.completeMerchantValidation(merchantSession);
        } catch (error) {
          console.error('Merchant validation failed:', error);
          session.abort();
        }
      };
      
      // Handle payment authorization
      session.onpaymentauthorized = async (event: any) => {
        try {
          // Gather the payment token from Apple Pay response
          const token = event.payment.token;
          
          // Create a payment with Moyasar using the Apple Pay token
          const paymentResponse = await fetch('https://api.moyasar.com/v1/payments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${btoa(this.moyasarPublishableKey + ':')}`
            },
            body: JSON.stringify({
              amount: Math.round(cart.total * 100), // Convert to smallest currency unit (halalas)
              currency: 'SAR',
              description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
              callback_url: window.location.origin + '/checkout/confirmation',
              source: {
                type: 'applepay',
                token: JSON.stringify(token)
              },
              metadata: {
                order_id: `ORDER-${Date.now()}`,
                customer_email: billingDetails.email || 'customer@example.com',
                customer_name: `${billingDetails.first_name || ''} ${billingDetails.last_name || ''}`.trim()
              }
            })
          });
          
          const paymentResult = await paymentResponse.json();
          
          if (paymentResult.status === 'paid' || paymentResult.status === 'authorized') {
            session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
            
            const resultData: PaymentResult = {
              success: true,
              message: 'تم الدفع بنجاح عبر Apple Pay',
              transactionId: paymentResult.id,
              data: paymentResult
            };
            
            this._paymentResult.next(resultData);
            await loading.dismiss();
            this.presentSuccessToast(resultData.message);
            return resultData;
          } else {
            session.completePayment(window.ApplePaySession.STATUS_FAILURE);
            
            const errorData: PaymentResult = {
              success: false,
              message: paymentResult.message || 'فشل الدفع عبر Apple Pay',
              data: paymentResult
            };
            
            this._paymentResult.next(errorData);
            await loading.dismiss();
            this.presentErrorToast(errorData.message);
            return errorData;
          }
        } catch (error) {
          console.error('Payment processing failed:', error);
          session.completePayment(window.ApplePaySession.STATUS_FAILURE);
          
          const errorResult: PaymentResult = {
            success: false,
            message: 'حدث خطأ أثناء معالجة الدفع عبر Apple Pay',
            data: error
          };
          
          this._paymentResult.next(errorResult);
          await loading.dismiss();
          this.presentErrorToast(errorResult.message);
          return errorResult;
        }
      };
      
      // Start the Apple Pay session
      session.begin();
      
      await loading.dismiss();
      
      // Return initial status as the actual result will be handled by the session events
      return {
        success: true,
        message: 'تم بدء جلسة Apple Pay'
      };
    } catch (error) {
      await loading.dismiss();
      console.error('Apple Pay error:', error);
      
      const errorResult: PaymentResult = {
        success: false,
        message: 'حدث خطأ أثناء تهيئة Apple Pay',
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
   * Process STCPay payment using Moyasar's API
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  async processSTCPay(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    const loading = await this.loadingController.create({
      message: 'جاري معالجة الدفع عبر STC Pay...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // Initialize Moyasar if not already loaded
      if (typeof Moyasar === 'undefined') {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.moyasar.com/mpf/1.7.3/moyasar.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = (e) => reject(e);
          document.body.appendChild(script);
        });
      }
      
      // Initialize Moyasar form with STCPay option
      const moyasar = new Moyasar(this.moyasarPublishableKey);
      
      // Create payment form configuration for STCPay
      const form = moyasar.createForm({
        amount: Math.round(cart.total * 100), // Convert to smallest currency unit (halalas)
        currency: 'SAR',
        description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
        callback_url: window.location.origin + '/checkout/confirmation',
        metadata: {
          order_id: `ORDER-${Date.now()}`,
          customer_email: billingDetails.email || 'customer@example.com',
          customer_name: `${billingDetails.first_name || ''} ${billingDetails.last_name || ''}`.trim()
        }
      }, {
        saveCardOption: false,
        locale: 'ar',
        appearance: {
          direction: 'rtl',
          theme: 'default',
          labels: {
            methods: {
              stcpay: 'STC Pay'
            }
          }
        },
        methods: ['stcpay'], // Only show STCPay method
      });
      
      // Create a container for the payment form
      const container = document.createElement('div');
      container.id = 'stcpay-form-container';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      container.style.zIndex = '10000';
      container.style.display = 'flex';
      container.style.justifyContent = 'center';
      container.style.alignItems = 'center';
      
      // Create a close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '✕';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '20px';
      closeButton.style.right = '20px';
      closeButton.style.background = '#fff';
      closeButton.style.border = 'none';
      closeButton.style.borderRadius = '50%';
      closeButton.style.width = '40px';
      closeButton.style.height = '40px';
      closeButton.style.fontSize = '20px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = () => {
        document.body.removeChild(container);
      };
      
      // Create a form wrapper
      const formWrapper = document.createElement('div');
      formWrapper.style.width = '90%';
      formWrapper.style.maxWidth = '500px';
      formWrapper.style.padding = '30px';
      formWrapper.style.backgroundColor = '#fff';
      formWrapper.style.borderRadius = '10px';
      
      // Add a header
      const header = document.createElement('h2');
      header.textContent = 'الدفع باستخدام STC Pay';
      header.style.textAlign = 'center';
      header.style.marginBottom = '20px';
      header.style.fontFamily = 'Tajawal, sans-serif';
      header.style.color = '#ec1c24';
      
      // Create the form container
      const formContainer = document.createElement('div');
      formContainer.className = 'stcpay-form';
      
      // Add elements to DOM
      formWrapper.appendChild(header);
      formWrapper.appendChild(formContainer);
      container.appendChild(closeButton);
      container.appendChild(formWrapper);
      document.body.appendChild(container);
      
      // Mount the form
      form.mount('.stcpay-form');
      
      // Handle form events
      return new Promise<PaymentResult>((resolve) => {
        // Handle successful payment
        form.on('completed', (payment: any) => {
          document.body.removeChild(container);
          
          const paymentResult: PaymentResult = {
            success: true,
            message: 'تم الدفع بنجاح عبر STC Pay',
            transactionId: payment.id,
            data: payment
          };
          
          this._paymentResult.next(paymentResult);
          loading.dismiss();
          this.presentSuccessToast(paymentResult.message);
          resolve(paymentResult);
        });
        
        // Handle payment failure
        form.on('failed', (error: any) => {
          document.body.removeChild(container);
          
          const errorResult: PaymentResult = {
            success: false,
            message: error.message || 'فشل الدفع عبر STC Pay',
            data: error
          };
          
          this._paymentResult.next(errorResult);
          loading.dismiss();
          this.presentErrorToast(errorResult.message);
          resolve(errorResult);
        });
        
        // Handle modal close (user canceled)
        closeButton.addEventListener('click', () => {
          const cancelResult: PaymentResult = {
            success: false,
            message: 'تم إلغاء الدفع عبر STC Pay',
          };
          
          this._paymentResult.next(cancelResult);
          loading.dismiss();
          resolve(cancelResult);
        });
      });
    } catch (error) {
      await loading.dismiss();
      console.error('STC Pay error:', error);
      
      const errorResult: PaymentResult = {
        success: false,
        message: 'حدث خطأ أثناء معالجة الدفع عبر STC Pay',
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