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
        // Load CSS first
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = 'https://cdn.moyasar.com/mpf/1.15.0/moyasar.css';
        document.head.appendChild(styleLink);
        
        // Then load JavaScript
        const script = document.createElement('script');
        script.src = 'https://cdn.moyasar.com/mpf/1.15.0/moyasar.js';
        script.async = true;
        
        script.onload = () => {
          console.log('Moyasar script (v1.15.0) loaded successfully');
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
      
      // Create a container for the payment form
      const container = document.createElement('div');
      container.id = 'creditcard-form-container';
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
      formWrapper.style.maxHeight = '70vh';
      formWrapper.style.overflowY = 'auto';
      formWrapper.style.padding = '30px';
      formWrapper.style.backgroundColor = '#fff';
      formWrapper.style.borderRadius = '10px';
      
      // Add a header
      const header = document.createElement('h2');
      header.textContent = 'الدفع بالبطاقة الائتمانية';
      header.style.textAlign = 'center';
      header.style.marginBottom = '20px';
      header.style.fontFamily = 'Tajawal, sans-serif';
      header.style.color = '#ec1c24';
      
      // Add testing information for test environment
      const testInfoContainer = document.createElement('div');
      testInfoContainer.style.backgroundColor = '#f9f9f9';
      testInfoContainer.style.padding = '10px 15px';
      testInfoContainer.style.borderRadius = '8px';
      testInfoContainer.style.marginBottom = '20px';
      testInfoContainer.style.fontSize = '13px';
      testInfoContainer.style.border = '1px dashed #ddd';
      
      const testInfo = document.createElement('p');
      testInfo.innerHTML = '<strong>وضع الاختبار:</strong><br>' +
        'رقم البطاقة: 4111111111111111<br>' +
        'CVC: أي 3 أرقام | تاريخ الانتهاء: أي تاريخ مستقبلي';
      testInfo.style.margin = '0';
      testInfo.style.color = '#666';
      testInfo.style.textAlign = 'center';
      
      testInfoContainer.appendChild(testInfo);
      
      // Create the form container
      const formContainer = document.createElement('div');
      formContainer.className = 'credit-card-form';
      
      // Add elements to DOM
      formWrapper.appendChild(header);
      formWrapper.appendChild(testInfoContainer);
      formWrapper.appendChild(formContainer);
      container.appendChild(closeButton);
      container.appendChild(formWrapper);
      document.body.appendChild(container);
      
      // Initialize Moyasar with the credit card method
      const moyasar = new Moyasar(this.moyasarPublishableKey);
      console.log('Moyasar initialized successfully');
      
      // Create payment form with credit card method
      const form = moyasar.createForm({
        // Amount in the smallest currency unit (halalas)
        amount: Math.round(cart.total * 100),
        currency: 'SAR',
        description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
        callback_url: window.location.origin + '/checkout/confirmation',
        metadata: {
          order_id: `ORDER-${Date.now()}`,
          customer_email: billingDetails.email || 'customer@example.com',
          customer_name: `${billingDetails.first_name || ''} ${billingDetails.last_name || ''}`.trim()
        }
      }, {
        // Form configuration
        saveCardOption: false,
        locale: 'ar',
        appearance: {
          direction: 'rtl',
          theme: 'default',
          labels: {
            methods: {
              creditcard: 'بطاقة ائتمان'
            }
          },
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
        },
        methods: ['creditcard'], // Only show credit card method
      });
      
      // Mount the form
      form.mount('.credit-card-form');
      
      // Save payment ID before processing (recommended in docs)
      form.on('initiated', async (payment: any) => {
        console.log('Payment initiated:', payment);
        // Store payment ID in local storage for verification
        try {
          localStorage.setItem('creditcard_payment_id', payment.id);
        } catch (err) {
          console.error('Failed to save payment ID:', err);
        }
      });
      
      // Handle form events
      return new Promise<PaymentResult>((resolve) => {
        // Handle successful payment
        form.on('completed', (payment: any) => {
          if (container.parentNode) {
            document.body.removeChild(container);
          }
          
          const paymentResult: PaymentResult = {
            success: true,
            message: 'تم الدفع بنجاح',
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
          if (container.parentNode) {
            document.body.removeChild(container);
          }
          
          // Format error message
          let errorMessage = error.message || 'فشل الدفع';
          
          // Map common credit card errors to Arabic
          if (error.message?.includes('declined')) {
            errorMessage = 'تم رفض البطاقة من قبل البنك';
          } else if (error.message?.includes('incorrect number')) {
            errorMessage = 'رقم البطاقة غير صحيح';
          } else if (error.message?.includes('expired')) {
            errorMessage = 'البطاقة منتهية الصلاحية';
          } else if (error.message?.includes('invalid cvc')) {
            errorMessage = 'رمز الأمان CVC غير صحيح';
          } else if (error.message?.includes('insufficient funds')) {
            errorMessage = 'رصيد غير كافٍ في البطاقة';
          }
          
          const errorResult: PaymentResult = {
            success: false,
            message: errorMessage,
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
            message: 'تم إلغاء الدفع',
          };
          
          this._paymentResult.next(cancelResult);
          loading.dismiss();
          resolve(cancelResult);
        });
      });
    } catch (error) {
      await loading.dismiss();
      console.error('Credit card payment error:', error);
      
      const errorResult: PaymentResult = {
        success: false,
        message: 'حدث خطأ أثناء معالجة الدفع بالبطاقة',
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
      
      // Create a container for the Apple Pay form
      const container = document.createElement('div');
      container.id = 'applepay-form-container';
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
      header.textContent = 'الدفع باستخدام Apple Pay';
      header.style.textAlign = 'center';
      header.style.marginBottom = '20px';
      header.style.fontFamily = 'Tajawal, sans-serif';
      header.style.color = '#ec1c24';
      
      // Create the form container
      const formContainer = document.createElement('div');
      formContainer.className = 'applepay-form';
      
      // Add elements to DOM
      formWrapper.appendChild(header);
      formWrapper.appendChild(formContainer);
      container.appendChild(closeButton);
      container.appendChild(formWrapper);
      document.body.appendChild(container);
      
      // Initialize Moyasar with Apple Pay method
      const moyasar = new Moyasar(this.moyasarPublishableKey);
      
      // Create payment form with Apple Pay method
      const form = moyasar.createForm({
        // Amount in the smallest currency unit (halalas)
        amount: Math.round(cart.total * 100),
        currency: 'SAR',
        description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
        callback_url: window.location.origin + '/checkout/confirmation',
        metadata: {
          order_id: `ORDER-${Date.now()}`,
          customer_email: billingDetails.email || 'customer@example.com',
          customer_name: `${billingDetails.first_name || ''} ${billingDetails.last_name || ''}`.trim()
        }
      }, {
        // Form configuration
        saveCardOption: false,
        locale: 'ar',
        appearance: {
          direction: 'rtl',
          theme: 'default',
          labels: {
            methods: {
              applepay: 'Apple Pay'
            }
          }
        },
        methods: ['applepay'], // Only show Apple Pay method
        applepay: {
          country: 'SA', 
          label: 'DARZN',
          validateMerchantURL: 'https://api.moyasar.com/v1/applepay/validate',
        }
      });
      
      // Handle form events
      return new Promise<PaymentResult>((resolve) => {
        // Save payment ID before processing (recommended in docs)
        form.on('initiated', async (payment: any) => {
          console.log('Apple Pay payment initiated:', payment);
          // Store payment ID in local storage for verification
          try {
            localStorage.setItem('applepay_payment_id', payment.id);
          } catch (err) {
            console.error('Failed to save payment ID:', err);
          }
        });
        
        // Mount the form
        try {
          form.mount('.applepay-form');
        } catch (error) {
          console.error('Failed to mount Apple Pay form:', error);
          if (container.parentNode) {
            document.body.removeChild(container);
          }
          
          const errorResult: PaymentResult = {
            success: false,
            message: 'فشل في تهيئة نموذج Apple Pay',
            data: error
          };
          
          this._paymentResult.next(errorResult);
          loading.dismiss();
          this.presentErrorToast(errorResult.message);
          resolve(errorResult);
          return;
        }
        
        // Handle successful payment
        form.on('completed', (payment: any) => {
          if (container.parentNode) {
            document.body.removeChild(container);
          }
          
          const paymentResult: PaymentResult = {
            success: true,
            message: 'تم الدفع بنجاح عبر Apple Pay',
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
          if (container.parentNode) {
            document.body.removeChild(container);
          }
          
          // Format error message
          let errorMessage = error.message || 'فشل الدفع عبر Apple Pay';
          
          // Map common Apple Pay errors to Arabic
          if (error.message?.includes('canceled')) {
            errorMessage = 'تم إلغاء الدفع بواسطة المستخدم';
          } else if (error.message?.includes('not supported')) {
            errorMessage = 'Apple Pay غير مدعوم على هذا الجهاز';
          } else if (error.message?.includes('merchant validation')) {
            errorMessage = 'فشل التحقق من التاجر';
          }
          
          const errorResult: PaymentResult = {
            success: false,
            message: errorMessage,
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
            message: 'تم إلغاء الدفع عبر Apple Pay',
          };
          
          this._paymentResult.next(cancelResult);
          loading.dismiss();
          resolve(cancelResult);
        });
      });
    } catch (error) {
      await loading.dismiss();
      console.error('Apple Pay initialization error:', error);
      
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
   * Process STCPay payment using Moyasar's API according to the official documentation
   * @param cart The cart to process payment for
   * @param billingDetails The billing details
   */
  async processSTCPay(cart: Cart, billingDetails: any): Promise<PaymentResult> {
    // If using demo payments, show demo payment process
    if (this.useDemoPayments) {
      return this.showDemoPaymentProcess(cart, 'STC Pay');
    }
    
    const loading = await this.loadingController.create({
      message: 'جاري تجهيز الدفع عبر STC Pay...',
      spinner: 'circles'
    });
    
    await loading.present();
    
    try {
      // Initialize Moyasar library
      await this.initializeMoyasar();
      
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
      
      // Add testing information for test environment
      const testInfoContainer = document.createElement('div');
      testInfoContainer.style.backgroundColor = '#f9f9f9';
      testInfoContainer.style.padding = '10px 15px';
      testInfoContainer.style.borderRadius = '8px';
      testInfoContainer.style.marginBottom = '20px';
      testInfoContainer.style.fontSize = '13px';
      testInfoContainer.style.border = '1px dashed #ddd';
      
      const testInfo = document.createElement('p');
      testInfo.innerHTML = '<strong>وضع الاختبار:</strong><br>' +
        'استخدم رقم 0515555559 للفشل أو أي رقم آخر للنجاح.<br>' +
        'استخدم رمز OTP: 123456 للنجاح أو 111111 للفشل.';
      testInfo.style.margin = '0';
      testInfo.style.color = '#666';
      testInfo.style.textAlign = 'center';
      
      testInfoContainer.appendChild(testInfo);
      
      // Create the form container
      const formContainer = document.createElement('div');
      formContainer.className = 'stcpay-form';
      
      // Add elements to DOM
      formWrapper.appendChild(header);
      formWrapper.appendChild(testInfoContainer);
      formWrapper.appendChild(formContainer);
      container.appendChild(closeButton);
      container.appendChild(formWrapper);
      document.body.appendChild(container);
      
      // Initialize Moyasar with the STC Pay method
      const moyasar = new Moyasar(this.moyasarPublishableKey);
      
      // Create payment form with STC Pay method
      const form = moyasar.createForm({
        // Amount in the smallest currency unit (halalas)
        amount: Math.round(cart.total * 100),
        currency: 'SAR',
        description: `طلب من متجر DARZN (${cart.items.length} منتجات)`,
        callback_url: window.location.origin + '/checkout/confirmation',
        metadata: {
          order_id: `ORDER-${Date.now()}`,
          customer_email: billingDetails.email || 'customer@example.com',
          customer_name: `${billingDetails.first_name || ''} ${billingDetails.last_name || ''}`.trim()
        }
      }, {
        // Form configuration
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
      
      // Mount the form
      form.mount('.stcpay-form');
      
      // Handle form events
      return new Promise<PaymentResult>((resolve) => {
        // Save payment ID before processing (recommended in docs)
        form.on('initiated', async (payment: any) => {
          console.log('STC Pay payment initiated:', payment);
          // Store payment ID in local storage for verification
          try {
            localStorage.setItem('stcpay_payment_id', payment.id);
          } catch (err) {
            console.error('Failed to save payment ID:', err);
          }
        });
        
        // Handle successful payment
        form.on('completed', (payment: any) => {
          if (container.parentNode) {
            document.body.removeChild(container);
          }
          
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
          if (container.parentNode) {
            document.body.removeChild(container);
          }
          
          // Formatted error message based on STC Pay error types
          let errorMessage = error.message || 'فشل الدفع عبر STC Pay';
          
          // Map error messages to Arabic
          if (error.message?.includes('not registered')) {
            errorMessage = 'رقم الجوال غير مسجل في خدمة STC Pay';
          } else if (error.message?.includes('update your information')) {
            errorMessage = 'يرجى تحديث معلوماتك باستخدام تطبيق STC Pay قبل محاولة الدفع';
          } else if (error.message?.includes('account status is invalid')) {
            errorMessage = 'حالة حساب العميل غير صالحة، يرجى الاتصال بدعم STC Pay';
          } else if (error.message?.includes('OTP attempts')) {
            errorMessage = 'لقد استنفدت محاولات رمز التحقق، يرجى الانتظار 15 دقيقة ثم المحاولة مرة أخرى';
          } else if (error.message?.includes('wait 60 seconds')) {
            errorMessage = 'يرجى الانتظار 60 ثانية قبل محاولة دفع جديدة';
          } else if (error.message?.includes('Insufficient Balance')) {
            errorMessage = 'رصيد غير كافٍ في حساب STC Pay الخاص بك';
          } else if (error.message?.includes('daily transaction limit')) {
            errorMessage = 'لقد تجاوزت الحد المسموح به للمعاملات اليومية لحساب STC Pay الخاص بك';
          } else if (error.message?.includes('maximum allowed transaction amount')) {
            errorMessage = 'لقد تجاوزت الحد الأقصى المسموح به لمبلغ المعاملة';
          } else if (error.message?.includes('Connection timed out')) {
            errorMessage = 'انتهت مهلة الاتصال أثناء انتظار الرد من خدمة STC Pay';
          } else if (error.message?.includes('Invalid OTP')) {
            errorMessage = 'رمز التحقق غير صالح';
          }
          
          const errorResult: PaymentResult = {
            success: false,
            message: errorMessage,
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
        message: 'حدث خطأ أثناء تهيئة خدمة STC Pay',
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