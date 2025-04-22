import { Component, OnInit, Input, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { PaymentService } from '../../services/payment.service';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

declare var Moyasar: any;

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.scss'],
  standalone: false
})
export class PaymentFormComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() amount: number;
  @Input() description: string = 'DARZN Order Payment';
  @Output() paymentComplete: EventEmitter<any> = new EventEmitter();
  @Output() paymentFailed: EventEmitter<any> = new EventEmitter();
  
  paymentFormId = 'moyasar-form';
  isInitialized = false;
  isProcessing = false;
  isApplePayAvailable = false;
  private moyasarScriptLoaded = false;
  private moyasarScript: HTMLScriptElement;

  constructor(
    private paymentService: PaymentService,
    private toastController: ToastController
  ) { 
    // Check if Apple Pay is available
    this.isApplePayAvailable = this.paymentService.isApplePaySupported();
  }

  ngOnInit() {
    // Generate a unique ID for the payment form
    this.paymentFormId = 'moyasar-form-' + Math.random().toString(36).substring(2, 9);
  }

  ngAfterViewInit() {
    this.loadMoyasarScript();
  }

  ngOnDestroy() {
    // Remove Moyasar script if it was added by this component
    if (this.moyasarScript && this.moyasarScript.parentNode) {
      this.moyasarScript.parentNode.removeChild(this.moyasarScript);
    }
  }

  loadMoyasarScript() {
    this.isProcessing = true;
    
    // Check if Moyasar is already loaded
    if (typeof Moyasar !== 'undefined') {
      this.moyasarScriptLoaded = true;
      this.initForm();
      return;
    }
    
    // Load Moyasar script
    this.moyasarScript = document.createElement('script');
    this.moyasarScript.src = 'https://cdn.moyasar.com/mpf/1.7.3/moyasar.js';
    this.moyasarScript.async = true;
    
    this.moyasarScript.onload = () => {
      console.log('Moyasar script loaded successfully');
      this.moyasarScriptLoaded = true;
      this.initForm();
    };
    
    this.moyasarScript.onerror = (error) => {
      console.error('Failed to load Moyasar script:', error);
      this.isProcessing = false;
      this.presentToast('فشل تحميل نموذج الدفع. الرجاء المحاولة مرة أخرى.', 'danger');
    };
    
    document.head.appendChild(this.moyasarScript);
  }

  initForm() {
    if (!this.amount || this.amount <= 0) {
      console.error('Invalid payment amount');
      this.isProcessing = false;
      return;
    }
    
    if (!this.moyasarScriptLoaded) {
      console.error('Moyasar script not loaded');
      this.isProcessing = false;
      return;
    }
    
    try {
      // Clear the container first in case of re-initialization
      const container = document.getElementById(this.paymentFormId);
      if (container) {
        container.innerHTML = '';
      }
      
      // Initialize Moyasar payment form
      Moyasar.init({
        element: '#' + this.paymentFormId,
        amount: this.amount * 100, // Convert from SAR to halalas
        currency: 'SAR',
        description: this.description,
        publishable_api_key: environment.moyasarPublishableKey,
        callback_url: window.location.origin + '/checkout',
        methods: ['creditcard'],
        on_completed: (payment: any) => {
          this.handlePaymentCallback(payment);
        }
      });
      
      this.isInitialized = true;
      console.log('Moyasar form initialized successfully');
    } catch (error) {
      console.error('Error initializing Moyasar form:', error);
      this.presentToast('حدث خطأ أثناء تهيئة نموذج الدفع', 'danger');
    } finally {
      this.isProcessing = false;
    }
  }
  
  handlePaymentCallback(payment: any) {
    console.log('Payment callback received:', payment);
    
    if (payment.status === 'paid' || payment.status === 'authorized') {
      // Payment successful
      this.presentToast('تمت عملية الدفع بنجاح', 'success');
      this.paymentComplete.emit({
        id: payment.id,
        status: payment.status,
        amount: payment.amount / 100, // Convert from halalas to SAR
        source: payment.source
      });
    } else {
      // Payment failed
      this.presentToast('فشلت عملية الدفع: ' + (payment.source?.message || 'خطأ غير معروف'), 'danger');
      this.paymentFailed.emit({
        id: payment.id || '',
        status: payment.status || 'failed',
        message: payment.source?.message || 'Payment failed'
      });
    }
  }
  
  // Process payment with Apple Pay
  processApplePay() {
    this.isProcessing = true;
    
    this.paymentService.processApplePayPayment(this.amount, this.description)
      .subscribe(
        (response) => {
          this.isProcessing = false;
          
          if (response.success === false) {
            this.presentToast('فشل في تهيئة Apple Pay: ' + response.message, 'danger');
            return;
          }
          
          if (response.initiated) {
            console.log('Apple Pay payment initiated');
            // The actual payment processing happens in the payment service
            // We'll receive the result through the onpaymentauthorized callback
          }
        },
        (error) => {
          this.isProcessing = false;
          console.error('Error initiating Apple Pay payment:', error);
          this.presentToast('حدث خطأ أثناء معالجة الدفع بواسطة Apple Pay', 'danger');
        }
      );
  }
  
  // Helper method to retry form initialization
  retry() {
    this.loadMoyasarScript();
  }
  
  // Present toast message
  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color
    });
    toast.present();
  }
}