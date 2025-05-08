import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { IonicModule, LoadingController, AlertController, ToastController, ModalController } from '@ionic/angular';
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
import { environment } from '../../../environments/environment';
import { CurrencyIconComponent } from '../../components/currency-icon/currency-icon.component';

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
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, RouterModule, CurrencyIconComponent]
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
  
  // Handle step change from step indicator
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
            this.presentToast('يرجى إدخال رقم هاتف صحيح لـ STC Pay', 'danger');
            return false;
          }
        }
        
        return true;
      } else {
        this.presentToast('يرجى اختيار طريقة الدفع', 'danger');
        return false;
      }
    }
    
    return true;
  }
  
  // Select payment method
  selectPaymentMethod(method: string) {
    this.paymentMethod = method;
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
      // Prepare billing information from the form or selected address
      let billingDetails;
      
      if (this.selectedAddressId) {
        // Use the selected saved address
        const selectedAddress = this.savedAddresses.find(address => 
          address.id === this.selectedAddressId);
          
        if (selectedAddress) {
          billingDetails = {
            first_name: selectedAddress.first_name,
            last_name: selectedAddress.last_name,
            company: selectedAddress.company || '',
            address_1: selectedAddress.address_1,
            address_2: selectedAddress.address_2 || '',
            city: selectedAddress.city,
            state: selectedAddress.state || 'الرياض',
            postcode: selectedAddress.postcode || '',
            country: selectedAddress.country || 'SA',
            email: selectedAddress.email || this.jwtAuthService.currentUserValue?.email || '',
            phone: selectedAddress.phone || ''
          };
        }
      } else {
        // Use form values with proper field mapping to WooCommerce expected format
        billingDetails = {
          first_name: this.shippingForm.get('firstName').value,
          last_name: this.shippingForm.get('lastName').value,
          address_1: this.shippingForm.get('address1').value,
          address_2: this.shippingForm.get('address2').value || '',
          city: this.shippingForm.get('city').value, // This is the neighborhood/district
          state: this.shippingForm.get('state').value || 'الرياض', // City (Riyadh)
          postcode: this.shippingForm.get('postalCode').value || '',
          country: this.shippingForm.get('country').value || 'SA',
          email: this.shippingForm.get('email').value,
          phone: this.shippingForm.get('phone').value
        };
      }

      try {
        // Create credit card payment data
        const creditCardData = {
          cardHolderName: this.creditCardHolderName,
          cardNumber: this.creditCardNumber,
          cardExpiry: this.creditCardExpiry,
          cardCvc: this.creditCardCvc
        };
        
        // Process payment - async/await pattern
        const paymentResult = await this.paymentService.processCreditCardPayment(
          this.cart, 
          billingDetails
        );
        
        if (paymentResult.success) {
          // Create order with payment information
          this.orderService.createOrder(
            this.cart,
            billingDetails,
            billingDetails, // Use same address for shipping
            'moyasar_cc', // Payment method code
            paymentResult
          ).subscribe(
            (order) => {
              this.orderId = order.id;
              loading.dismiss();
              this.nextStep(); // Move to confirmation step
              this.presentToast('تم إتمام الدفع وإنشاء الطلب بنجاح', 'success');
              
              // Clear cart after successful order
              this.cartService.clearCart();
            },
            (error) => {
              loading.dismiss();
              this.presentToast('تم الدفع ولكن حدث خطأ أثناء إنشاء الطلب', 'warning');
              console.error('Order error:', error);
            }
          );
        } else {
          loading.dismiss();
          this.presentToast('فشل في معالجة الدفع: ' + paymentResult.message, 'danger');
        }
      } catch (paymentError) {
        console.error('Payment processing error:', paymentError);
        
        // If demo checkout is allowed, create order anyway
        if (environment.allowDemoCheckout) {
          // Create order without actual payment processing
          this.orderService.createOrder(
            this.cart,
            billingDetails,
            billingDetails, // Use same address for shipping
            'moyasar_cc' // Payment method code
          ).subscribe(
            (order) => {
              this.orderId = order.id;
              loading.dismiss();
              this.nextStep(); // Move to confirmation step
              this.presentToast('تم إتمام الدفع وإنشاء الطلب بنجاح', 'success');
              
              // Clear cart after successful order
              this.cartService.clearCart();
            },
            (error) => {
              loading.dismiss();
              this.presentToast('حدث خطأ أثناء إنشاء الطلب', 'danger');
              console.error('Order error:', error);
            }
          );
        } else {
          loading.dismiss();
          this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
        }
      }
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
      // Prepare billing information from the form or selected address
      let billingDetails;
      
      if (this.selectedAddressId) {
        // Use the selected saved address
        const selectedAddress = this.savedAddresses.find(address => 
          address.id === this.selectedAddressId);
          
        if (selectedAddress) {
          billingDetails = {
            first_name: selectedAddress.first_name,
            last_name: selectedAddress.last_name,
            company: selectedAddress.company || '',
            address_1: selectedAddress.address_1,
            address_2: selectedAddress.address_2 || '',
            city: selectedAddress.city,
            state: selectedAddress.state || 'الرياض',
            postcode: selectedAddress.postcode || '',
            country: selectedAddress.country || 'SA',
            email: selectedAddress.email || this.jwtAuthService.currentUserValue?.email || '',
            phone: selectedAddress.phone || ''
          };
        }
      } else {
        // Use form values with proper field mapping
        billingDetails = {
          first_name: this.shippingForm.get('firstName').value,
          last_name: this.shippingForm.get('lastName').value,
          address_1: this.shippingForm.get('address1').value,
          address_2: this.shippingForm.get('address2').value || '',
          city: this.shippingForm.get('city').value, // Neighborhood/district
          state: this.shippingForm.get('state').value || 'الرياض', // City (Riyadh)
          postcode: this.shippingForm.get('postalCode').value || '',
          country: this.shippingForm.get('country').value || 'SA',
          email: this.shippingForm.get('email').value,
          phone: this.shippingForm.get('phone').value
        };
      }

      try {
        // Process payment - async/await pattern
        const paymentResult = await this.paymentService.processApplePay(
          this.cart, 
          billingDetails
        );
        
        if (paymentResult.success) {
          // Create order with payment information
          this.orderService.createOrder(
            this.cart,
            billingDetails,
            billingDetails, // Use same address for shipping
            'moyasar_applepay', // Payment method code
            paymentResult
          ).subscribe(
            (order) => {
              this.orderId = order.id;
              loading.dismiss();
              this.nextStep(); // Move to confirmation step
              this.presentToast('تم إتمام الدفع وإنشاء الطلب بنجاح', 'success');
              
              // Clear cart after successful order
              this.cartService.clearCart();
            },
            (error) => {
              loading.dismiss();
              this.presentToast('تم الدفع ولكن حدث خطأ أثناء إنشاء الطلب', 'warning');
              console.error('Order error:', error);
            }
          );
        } else {
          loading.dismiss();
          this.presentToast('فشل في معالجة الدفع: ' + paymentResult.message, 'danger');
        }
      } catch (paymentError) {
        console.error('Apple Pay processing error:', paymentError);
        
        // If demo checkout is allowed, create order anyway
        if (environment.allowDemoCheckout) {
          // Create order without actual payment processing
          this.orderService.createOrder(
            this.cart,
            billingDetails,
            billingDetails, // Use same address for shipping
            'moyasar_applepay' // Payment method code
          ).subscribe(
            (order) => {
              this.orderId = order.id;
              loading.dismiss();
              this.nextStep(); // Move to confirmation step
              this.presentToast('تم إتمام الدفع وإنشاء الطلب بنجاح عبر Apple Pay', 'success');
              
              // Clear cart after successful order
              this.cartService.clearCart();
            },
            (error) => {
              loading.dismiss();
              this.presentToast('حدث خطأ أثناء إنشاء الطلب', 'danger');
              console.error('Order error:', error);
            }
          );
        } else {
          loading.dismiss();
          this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
        }
      }
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
      // Prepare billing information from the form or selected address
      let billingDetails;
      
      if (this.selectedAddressId) {
        // Use the selected saved address
        const selectedAddress = this.savedAddresses.find(address => 
          address.id === this.selectedAddressId);
          
        if (selectedAddress) {
          billingDetails = {
            first_name: selectedAddress.first_name,
            last_name: selectedAddress.last_name,
            company: selectedAddress.company || '',
            address_1: selectedAddress.address_1,
            address_2: selectedAddress.address_2 || '',
            city: selectedAddress.city,
            state: selectedAddress.state || 'الرياض',
            postcode: selectedAddress.postcode || '',
            country: selectedAddress.country || 'SA',
            email: selectedAddress.email || this.jwtAuthService.currentUserValue?.email || '',
            phone: selectedAddress.phone || ''
          };
        }
      } else {
        // Use form values with proper field mapping
        billingDetails = {
          first_name: this.shippingForm.get('firstName').value,
          last_name: this.shippingForm.get('lastName').value,
          address_1: this.shippingForm.get('address1').value,
          address_2: this.shippingForm.get('address2').value || '',
          city: this.shippingForm.get('city').value, // Neighborhood/district
          state: this.shippingForm.get('state').value || 'الرياض', // City (Riyadh)
          postcode: this.shippingForm.get('postalCode').value || '',
          country: this.shippingForm.get('country').value || 'SA',
          email: this.shippingForm.get('email').value,
          phone: this.shippingForm.get('phone').value
        };
      }

      try {
        // Process payment with STCPay
        // Include phone number in billing details
        billingDetails.phone = this.phoneNumber;
        
        const paymentResult = await this.paymentService.processSTCPay(
          this.cart, 
          billingDetails
        );
        
        if (paymentResult.success) {
          // Create order with payment information
          this.orderService.createOrder(
            this.cart,
            billingDetails,
            billingDetails, // Use same address for shipping
            'moyasar_stcpay', // Payment method code
            paymentResult
          ).subscribe(
            (order) => {
              this.orderId = order.id;
              loading.dismiss();
              this.nextStep(); // Move to confirmation step
              this.presentToast('تم إتمام الدفع وإنشاء الطلب بنجاح', 'success');
              
              // Clear cart after successful order
              this.cartService.clearCart();
            },
            (error) => {
              loading.dismiss();
              this.presentToast('تم الدفع ولكن حدث خطأ أثناء إنشاء الطلب', 'warning');
              console.error('Order error:', error);
            }
          );
        } else {
          loading.dismiss();
          this.presentToast('فشل في معالجة الدفع: ' + paymentResult.message, 'danger');
        }
      } catch (paymentError) {
        console.error('STC Pay processing error:', paymentError);
        
        // If demo checkout is allowed, create order anyway
        if (environment.allowDemoCheckout) {
          // Create order without actual payment processing
          this.orderService.createOrder(
            this.cart,
            billingDetails,
            billingDetails, // Use same address for shipping
            'moyasar_stcpay' // Payment method code
          ).subscribe(
            (order) => {
              this.orderId = order.id;
              loading.dismiss();
              this.nextStep(); // Move to confirmation step
              this.presentToast('تم إتمام الدفع وإنشاء الطلب بنجاح عبر STC Pay', 'success');
              
              // Clear cart after successful order
              this.cartService.clearCart();
            },
            (error) => {
              loading.dismiss();
              this.presentToast('حدث خطأ أثناء إنشاء الطلب', 'danger');
              console.error('Order error:', error);
            }
          );
        } else {
          loading.dismiss();
          this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
        }
      }
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
      // Prepare billing information from the form or selected address
      let billingDetails;
      
      if (this.selectedAddressId) {
        // Use the selected saved address
        const selectedAddress = this.savedAddresses.find(address => 
          address.id === this.selectedAddressId);
          
        if (selectedAddress) {
          billingDetails = {
            first_name: selectedAddress.first_name,
            last_name: selectedAddress.last_name,
            company: selectedAddress.company || '',
            address_1: selectedAddress.address_1,
            address_2: selectedAddress.address_2 || '',
            city: selectedAddress.city,
            state: selectedAddress.state || 'الرياض',
            postcode: selectedAddress.postcode || '',
            country: selectedAddress.country || 'SA',
            email: selectedAddress.email || this.jwtAuthService.currentUserValue?.email || '',
            phone: selectedAddress.phone || ''
          };
        }
      } else {
        // Use form values with proper field mapping to WooCommerce expected format
        billingDetails = {
          first_name: this.shippingForm.get('firstName').value,
          last_name: this.shippingForm.get('lastName').value,
          address_1: this.shippingForm.get('address1').value,
          address_2: this.shippingForm.get('address2').value || '',
          city: this.shippingForm.get('city').value, // This is the neighborhood/district
          state: this.shippingForm.get('state').value || 'الرياض', // City (Riyadh)
          postcode: this.shippingForm.get('postalCode').value || '',
          country: this.shippingForm.get('country').value || 'SA',
          email: this.shippingForm.get('email').value,
          phone: this.shippingForm.get('phone').value
        };
      }
      
      // Create order with proper data mapping
      this.orderService.createOrder(
        this.cart,
        billingDetails,
        billingDetails, // Use same address for shipping
        'cod' // Payment method code
      ).subscribe(
        (order) => {
          this.orderId = order.id;
          loading.dismiss();
          this.nextStep(); // Move to confirmation step
          this.presentToast('تم إنشاء طلبك بنجاح', 'success');
          
          // Clear cart after successful order
          this.cartService.clearCart();
        },
        (error) => {
          loading.dismiss();
          this.presentToast('حدث خطأ أثناء إنشاء الطلب', 'danger');
          console.error('Order error:', error);
        }
      );
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