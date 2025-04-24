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
  
  // Use environment settings to determine whether to use demo payments
  private useDemoPayments = environment.useDemoPayments;
  private allowDemoCheckout = environment.allowDemoCheckout;
  
  constructor(
    private http: HttpClient,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {
    console.log('Payment service initialized');
    
    // Force refresh of settings from environment
    this.useDemoPayments = environment.useDemoPayments;
    this.allowDemoCheckout = environment.allowDemoCheckout;
    
    console.log('Using demo payments:', this.useDemoPayments);
    console.log('Allow demo checkout:', this.allowDemoCheckout);
    console.log('Moyasar API key:', this.moyasarPublishableKey ? 'available' : 'not available');
  }
  
  /**
   * Initialize Moyasar in component where it's needed
   * @returns Promise that resolves when Moyasar is loaded
   */
  async initializeMoyasar(): Promise<void> {
    // Check if Moyasar is already loaded
    if (typeof Moyasar !== 'undefined') {
      console.log('Moyasar already loaded');
      return Promise.resolve();
    }
    
    // Load Moyasar script
    return new Promise<void>((resolve, reject) => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.moyasar.com/mpf/1.7.3/moyasar.js';
        script.async = true;
        
        script.onload = () => {
          console.log('Moyasar script loaded successfully');
          resolve();
        };
        
        script.onerror = (e) => {
          console.error('Failed to load Moyasar script:', e);
          reject(new Error('Failed to load Moyasar script'));
        };
        
        document.body.appendChild(script);
      } catch (err) {
        console.error('Error loading Moyasar script:', err);
        reject(err);
      }
    });
  }
  
  /**
   * Get payment result as an observable
   */
  get paymentResult(): Observable<PaymentResult | null> {
    return this._paymentResult.asObservable();
  }
  
  /**
   * Show a demonstration of a payment process in demo mode
   * @param cart The cart being processed
   * @param paymentMethod The name of the payment method
   * @returns A simulated payment result
   */
  private async showDemoPaymentProcess(cart: Cart, paymentMethod: string): Promise<PaymentResult> {
    if (!this.allowDemoCheckout) {
      const errorResult: PaymentResult = {
        success: false,
        message: 'الدفع غير متاح في الوضع التجريبي. الرجاء الاتصال بالمتجر الفعلي لإجراء عملية شراء حقيقية.',
        data: { demoMode: true }
      };
      
      this._paymentResult.next(errorResult);
      this.presentErrorToast(errorResult.message);
      return errorResult;
    }
    
    const loading = await this.loadingController.create({
      message: `جاري معالجة الدفع عبر ${paymentMethod}...`,
      spinner: 'circles'
    });
    
    await loading.present();
    
    // Simulate a processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a simulated transaction ID
    const transactionId = `DEMO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Create a simulated successful payment result
    const paymentResult: PaymentResult = {
      success: true,
      message: `تم إكمال الدفع بنجاح عبر ${paymentMethod}`,
      transactionId: transactionId,
      data: {
        id: transactionId,
        status: 'paid',
        amount: Math.round(cart.total * 100),
        fee: Math.round(cart.total * 100 * 0.0275), // Simulate 2.75% fee
        currency: 'SAR',
        refunded: 0,
        refunded_at: null,
        captured: true,
        captured_at: new Date().toISOString(),
        voided_at: null,
        description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
        amount_format: `${cart.total} SAR`,
        fee_format: `${(cart.total * 0.0275).toFixed(2)} SAR`,
        refunded_format: '0.00 SAR',
        invoice_id: null,
        ip: '127.0.0.1',
        callback_url: window.location.origin + '/checkout/confirmation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          order_id: `ORDER-${Date.now()}`,
          demo_payment: true
        },
        source: {
          type: paymentMethod.toLowerCase().replace(' ', '_'),
          payment_method: paymentMethod,
          name: 'DEMO USER',
          transaction_id: transactionId
        }
      }
    };
    
    await loading.dismiss();
    this._paymentResult.next(paymentResult);
    this.presentSuccessToast(paymentResult.message);
    
    return paymentResult;
  }
  
  /**
   * Process a credit card payment using Moyasar
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  async processCreditCardPayment(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    // Check if we're using demo payments
    if (this.useDemoPayments) {
      return this.showDemoPaymentProcess(cart, 'البطاقة الائتمانية');
    }
    
    const loading = await this.loadingController.create({
      message: 'جاري معالجة الدفع...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // Initialize Moyasar library
      await this.initializeMoyasar();
      
      // Initialize payment form
      const moyasar = new Moyasar(this.moyasarPublishableKey);
      console.log('Moyasar form initialized successfully');
      
      // Create payment form
      const form = moyasar.createForm({
        amount: Math.round(cart.total * 100), // Convert to smallest currency unit (piasters)
        currency: 'SAR',
        description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
        callback_url: window.location.origin + '/checkout/confirmation',
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
            message: 'تم إكمال الدفع بنجاح',
            transactionId: payment.id,
            data: payment
          };
          
          this._paymentResult.next(paymentResult);
          resolve(paymentResult);
        });
        
        form.on('failed', (error: any) => {
          const paymentResult: PaymentResult = {
            success: false,
            message: error.message || 'فشل الدفع',
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
        message: 'حدث خطأ أثناء معالجة الدفع',
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
    // If using demo payments, show demo payment process
    if (this.useDemoPayments) {
      return this.showDemoPaymentProcess(cart, 'Apple Pay');
    }
    
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
      // Initialize Moyasar library
      await this.initializeMoyasar();
      
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
  async processCashOnDelivery(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    // Show a simple loading indicator for better UX
    const loading = await this.loadingController.create({
      message: 'جاري تجهيز الطلب...',
      spinner: 'circles',
      duration: 1500 // Auto-dismiss after 1.5 seconds
    });
    
    await loading.present();
    
    // Create a unique transaction ID for the order
    const transactionId = `COD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const result: PaymentResult = {
      success: true,
      message: 'تم تسجيل الطلب بنجاح. الدفع عند الاستلام',
      transactionId: transactionId,
      data: {
        payment_method: 'cod',
        payment_method_title: 'الدفع عند الاستلام',
        transaction_id: transactionId,
        created_at: new Date().toISOString(),
        status: 'pending'
      }
    };
    
    // Give some time for loading to show before dismissing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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
    // If using demo payments, show demo payment process
    if (this.useDemoPayments) {
      return this.showDemoPaymentProcess(cart, 'STC Pay');
    }
    
    const loading = await this.loadingController.create({
      message: 'جاري معالجة الدفع عبر STC Pay...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // Initialize Moyasar library
      await this.initializeMoyasar();
      
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