import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LoadingController, AlertController, ToastController, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { PaymentService } from '../../services/payment.service';
import { OtpService } from '../../services/otp.service';
import { AddressService } from '../../services/address.service';
import { AddressHelper } from '../../helpers/address-helper';
import { User } from '../../interfaces/user.interface';
import { Cart } from '../../interfaces/cart.interface';
import { Address, AddressResponse } from '../../interfaces/address.interface';
// Define the CheckoutStep type locally
export type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

/**
 * Redesigned Checkout Page Component based on provided mockups
 * 
 * This component handles the complete checkout flow including:
 * - Shipping information collection
 * - Payment methods (Credit Card via Moyasar, Apple Pay for iOS, STCPay, Cash on Delivery)
 * - Order confirmation
 */
@Component({
  selector: 'app-checkout',
  templateUrl: './checkout-new.page.html',
  styleUrls: ['./checkout-new.page.scss'],
})
export class CheckoutNewPage implements OnInit, OnDestroy {
  // Basic data
  cart: Cart;
  user: User;
  shippingForm: FormGroup;
  
  // Navigation and state
  currentStep: CheckoutStep = 'shipping';
  isLoading = true;
  placingOrder = false;
  orderId: number | null = null;
  
  // Payment related properties
  paymentMethod = 'creditCard'; // Default payment method
  showCreditCardForm = false;
  isApplePayAvailable = false;
  isStcPaySelected = false;
  
  // Credit card form fields
  creditCardHolderName: string = '';
  creditCardNumber: string = '';
  creditCardExpiry: string = '';
  creditCardCvc: string = '';
  phoneNumber: string = '';
  
  // Address management
  savedAddresses: Address[] = [];
  selectedAddressId: string | number | null = null;
  
  private cartSubscription: Subscription;
  private userSubscription: Subscription;

  constructor(
    private formBuilder: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    public authService: AuthService,
    public jwtAuthService: JwtAuthService,
    private paymentService: PaymentService,
    private otpService: OtpService,
    private addressService: AddressService,
    private addressHelper: AddressHelper,
    private router: Router,
    private route: ActivatedRoute,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController
  ) { 
    console.log('New Checkout page initialized');
  }

  ngOnInit() {
    this.initForm();
    this.loadUserData();
    
    // Check for Apple Pay availability
    this.isApplePayAvailable = this.detectApplePayAvailability();
    
    // Subscribe to cart changes
    this.cartSubscription = this.cartService.cart.subscribe(cart => {
      this.cart = cart;
      this.isLoading = false;
      
      // If cart is empty, redirect to cart page
      if (!cart.items || cart.items.length === 0) {
        this.router.navigate(['/cart']);
        return;
      }
    });
  }
  
  // Ionic lifecycle hook - will be called each time the view becomes active
  ionViewWillEnter() {
    console.log('New Checkout page entered');
    
    // If cart is empty, redirect to cart page
    if (!this.cart?.items || this.cart?.items.length === 0) {
      console.log('Cart is empty, redirecting to cart page');
      this.router.navigate(['/cart']);
    }
    
    // Load saved addresses
    this.loadSavedAddresses();
  }
  
  ngOnDestroy() {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  // Initialize shipping form
  initForm() {
    this.shippingForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]+$/), Validators.minLength(9)]],
      address1: ['', [Validators.required]],
      address2: [''],
      city: ['', [Validators.required]],
      state: ['الرياض', [Validators.required]],
      postalCode: ['', [Validators.pattern(/^[0-9]+$/)]],
      country: ['SA', [Validators.required]], // Default to Saudi Arabia
      notes: ['']
    });
  }

  // Load user data if logged in
  loadUserData() {
    this.isLoading = true;
    
    // Check if user is authenticated with JWT
    if (this.jwtAuthService.isAuthenticated && this.jwtAuthService.currentUserValue) {
      const jwtUser = this.jwtAuthService.currentUserValue;
      this.user = jwtUser;
      
      // Pre-fill form with JWT user data
      this.shippingForm.patchValue({
        firstName: jwtUser.first_name || '',
        lastName: jwtUser.last_name || '',
        email: jwtUser.email || '',
        phone: jwtUser.billing?.phone || '',
        address1: jwtUser.shipping?.address_1 || '',
        address2: jwtUser.shipping?.address_2 || '',
        city: jwtUser.shipping?.city || '',
        state: jwtUser.shipping?.state || 'الرياض',
        postalCode: jwtUser.shipping?.postcode || '',
        country: jwtUser.shipping?.country || 'SA'
      });
      
      this.isLoading = false;
      return;
    }
    
    // Fallback to legacy auth service
    if (this.authService.isLoggedIn && this.authService.user) {
      this.authService.user.subscribe((legacyUser: any) => {
        if (legacyUser) {
          this.user = legacyUser;
          
          // Pre-fill form with legacy user data
          this.shippingForm.patchValue({
            firstName: legacyUser.firstName || legacyUser.first_name || '',
            lastName: legacyUser.lastName || legacyUser.last_name || '',
            email: legacyUser.email || '',
            phone: legacyUser.phone || '',
            address1: legacyUser.address1 || '',
            city: legacyUser.city || '',
            state: legacyUser.state || 'الرياض',
            postalCode: legacyUser.postalCode || '',
            country: legacyUser.country || 'SA'
          });
        }
        this.isLoading = false;
      });
    } else {
      this.isLoading = false;
    }
  }
  
  // Load saved addresses for logged-in users
  loadSavedAddresses() {
    this.isLoading = true;
    
    // Use AddressHelper to get all addresses
    this.addressHelper.getAllAddresses().subscribe(
      (addresses) => {
        this.savedAddresses = addresses;
        
        // Select default address if available
        if (addresses && addresses.length > 0) {
          const defaultAddress = addresses.find(addr => addr.is_default);
          if (defaultAddress) {
            this.selectedAddressId = defaultAddress.id;
          } else {
            // No default, select first address
            this.selectedAddressId = addresses[0].id;
          }
        }
        
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading addresses:', error);
        this.isLoading = false;
      }
    );
  }
  
  // Select an address from the saved addresses
  selectAddress(addressId: string | number) {
    this.selectedAddressId = addressId;
    
    // Find the selected address
    const selectedAddress = this.savedAddresses.find(addr => addr.id === addressId);
    if (selectedAddress) {
      // Update form with selected address data
      this.shippingForm.patchValue({
        firstName: selectedAddress.first_name || '',
        lastName: selectedAddress.last_name || '',
        email: selectedAddress.email || '',
        phone: selectedAddress.phone || '',
        address1: selectedAddress.address_1 || '',
        address2: selectedAddress.address_2 || '',
        city: selectedAddress.city || '',
        state: selectedAddress.state || 'الرياض',
        postalCode: selectedAddress.postcode || '',
        country: selectedAddress.country || 'SA'
      });
    }
  }
  
  // Navigate to the next step in the checkout flow
  nextStep() {
    // Validate the current step before proceeding
    if (this.validateCurrentStep()) {
      // Update the current step based on the current value
      if (this.currentStep === 'shipping') {
        this.currentStep = 'payment';
        this.showCreditCardForm = this.paymentMethod === 'creditCard';
        this.isStcPaySelected = this.paymentMethod === 'stcPay';
      } else if (this.currentStep === 'payment') {
        this.currentStep = 'confirmation';
      }
      
      // Scroll to top
      window.scrollTo(0, 0);
    }
  }
  
  // Go back to the previous step
  prevStep() {
    if (this.currentStep === 'payment') {
      this.currentStep = 'shipping';
    } else if (this.currentStep === 'confirmation') {
      this.currentStep = 'payment';
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
  }
  
  // Handle step change from checkout-steps component
  onStepChange(step: CheckoutStep) {
    // Only allow going back to previous steps
    if (
      (this.currentStep === 'payment' && step === 'shipping') ||
      (this.currentStep === 'confirmation' && (step === 'shipping' || step === 'payment'))
    ) {
      this.currentStep = step;
      window.scrollTo(0, 0);
    }
  }
  
  // Validate the current step
  validateCurrentStep(): boolean {
    if (this.currentStep === 'shipping') {
      // If an address is selected, we can proceed
      if (this.selectedAddressId) {
        return true;
      }
      
      // Otherwise, validate the shipping form
      if (this.shippingForm.valid) {
        return true;
      } else {
        // Mark all fields as touched to trigger validation messages
        Object.keys(this.shippingForm.controls).forEach(key => {
          const control = this.shippingForm.get(key);
          control.markAsTouched();
        });
        
        this.presentToast('يرجى إكمال جميع الحقول المطلوبة', 'danger');
        return false;
      }
    } else if (this.currentStep === 'payment') {
      // For now, just check if a payment method is selected
      if (this.paymentMethod) {
        // Additional validation for credit card if that's the selected method
        if (this.paymentMethod === 'creditCard' && this.showCreditCardForm) {
          if (!this.creditCardHolderName || !this.creditCardNumber || !this.creditCardExpiry || !this.creditCardCvc) {
            this.presentToast('يرجى إكمال جميع بيانات البطاقة', 'danger');
            return false;
          }
        }
        
        // Additional validation for STC Pay if that's the selected method
        if (this.paymentMethod === 'stcPay' && this.isStcPaySelected) {
          if (!this.phoneNumber || this.phoneNumber.length < 9) {
            this.presentToast('يرجى إدخال رقم هاتف صحيح', 'danger');
            return false;
          }
        }
        
        return true;
      } else {
        this.presentToast('يرجى اختيار طريقة دفع', 'danger');
        return false;
      }
    }
    
    return true;
  }
  
  // Select payment method
  selectPaymentMethod(method: string) {
    this.paymentMethod = method;
    
    // Update related flags based on payment method
    this.showCreditCardForm = method === 'creditCard';
    this.isStcPaySelected = method === 'stcPay';
  }
  
  // Process credit card payment
  async processPayment() {
    if (!this.validateCurrentStep()) {
      return;
    }
    
    const loading = await this.loadingController.create({
      message: 'جارٍ معالجة الدفع...',
      spinner: 'circles'
    });
    await loading.present();
    
    try {
      // Simulate payment processing
      setTimeout(() => {
        loading.dismiss();
        this.nextStep(); // Move to confirmation step
        this.presentToast('تم إتمام الدفع بنجاح', 'success');
      }, 2000);
      
      // In a real implementation, you would call your payment service here
      // this.paymentService.processCreditCardPayment(...)
    } catch (error) {
      loading.dismiss();
      this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
      console.error('Payment error:', error);
    }
  }
  
  // Process Apple Pay payment
  async processApplePay() {
    const loading = await this.loadingController.create({
      message: 'جارٍ تجهيز Apple Pay...',
      spinner: 'circles'
    });
    await loading.present();
    
    try {
      // Simulate Apple Pay processing
      setTimeout(() => {
        loading.dismiss();
        this.nextStep(); // Move to confirmation step
        this.presentToast('تم إتمام الدفع بنجاح عبر Apple Pay', 'success');
      }, 2000);
      
      // In a real implementation, you would call your payment service here
      // this.paymentService.processApplePay(...)
    } catch (error) {
      loading.dismiss();
      this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
      console.error('Apple Pay error:', error);
    }
  }
  
  // Process STC Pay payment
  async processStcPay() {
    if (!this.phoneNumber || this.phoneNumber.length < 9) {
      this.presentToast('يرجى إدخال رقم هاتف صحيح', 'danger');
      return;
    }
    
    const loading = await this.loadingController.create({
      message: 'جارٍ إرسال طلب الدفع إلى STC Pay...',
      spinner: 'circles'
    });
    await loading.present();
    
    try {
      // Simulate STC Pay processing
      setTimeout(() => {
        loading.dismiss();
        this.nextStep(); // Move to confirmation step
        this.presentToast('تم إتمام الدفع بنجاح عبر STC Pay', 'success');
      }, 2000);
      
      // In a real implementation, you would call your payment service here
      // this.paymentService.processStcPay(this.phoneNumber, this.cart.total)
    } catch (error) {
      loading.dismiss();
      this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
      console.error('STC Pay error:', error);
    }
  }
  
  // Process Cash on Delivery
  async processCashOnDelivery() {
    const loading = await this.loadingController.create({
      message: 'جارٍ تجهيز طلبك...',
      spinner: 'circles'
    });
    await loading.present();
    
    try {
      // Simulate order processing
      setTimeout(() => {
        loading.dismiss();
        this.nextStep(); // Move to confirmation step
        this.presentToast('تم إنشاء طلبك بنجاح', 'success');
      }, 2000);
      
      // In a real implementation, you would call your order service here
      // this.orderService.createOrder({...})
    } catch (error) {
      loading.dismiss();
      this.presentToast('حدث خطأ أثناء إنشاء الطلب', 'danger');
      console.error('Order error:', error);
    }
  }
  
  // Check if Apple Pay is available
  detectApplePayAvailability(): boolean {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const hasApplePayAPI = !!(window as any).ApplePaySession;
    return isIOS && hasApplePayAPI;
  }
  
  // Present a toast message
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }
}