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
import { User } from '../../interfaces/user.interface';
import { Cart } from '../../interfaces/cart.interface';


/**
 * Checkout Page Component
 * 
 * This component handles the complete checkout flow including:
 * - Authentication/verification for non-logged in users
 * - Shipping information collection
 * - Payment methods (Credit Card via Moyasar, Apple Pay for iOS, Cash on Delivery)
 * - Order review and submission
 * - Order confirmation
 */
@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.page.html',
  styleUrls: ['./checkout.page.scss'],
})
export class CheckoutPage implements OnInit, OnDestroy {
  cart: Cart;
  user: User;
  shippingForm: FormGroup;
  paymentMethod = 'creditCard'; // Default payment method
  step = 0; // 0: Initial OTP Verification, 1: Shipping, 2: Payment, 3: Review, 4: Confirmation
  isLoading = true;
  otpConfirmed = false;
  otpVerificationInProgress = false;
  verificationCode = '';
  placingOrder = false;
  orderId: number | null = null;
  creditCardFormSubmitted = false; // Track if the credit card form has been submitted
  paymentId: string | null = null; // Store the payment ID from Moyasar
  showCreditCardModal = false; // Control for the credit card modal
  isApplePayAvailable = false; // Flag to check if Apple Pay is available
  
  // Address management
  savedAddresses: any[] = [];
  selectedAddressId: number | null = null;
  
  private cartSubscription: Subscription;
  private userSubscription: Subscription;

  constructor(
    private formBuilder: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    public authService: AuthService, // Changed to public for template access
    public jwtAuthService: JwtAuthService, // Added JWT auth service
    private paymentService: PaymentService,
    private otpService: OtpService,
    private router: Router,
    private route: ActivatedRoute,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController
  ) { }

  ngOnInit() {
    this.initForm();
    this.loadUserData();
    
    // Check for Apple Pay availability using proper detection
    this.isApplePayAvailable = this.detectApplePayAvailability();
    
    // Check if we have payment callback parameters in the URL
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.handlePaymentCallback(params['id']);
      }
    });
    
    this.cartSubscription = this.cartService.cart.subscribe(cart => {
      this.cart = cart;
      this.isLoading = false;
      
      // If cart is empty and no payment ID in URL, redirect to cart page
      if (!this.paymentId && (!cart.items || cart.items.length === 0)) {
        this.router.navigate(['/cart']);
        return;
      }
      
      // Set initial step based on authentication status
      if (this.jwtAuthService.isAuthenticated || this.authService.isLoggedIn) {
        // User is logged in (via JWT or legacy auth), start at shipping info step
        console.log('User is authenticated, setting step to 1 (shipping)');
        this.step = 1;
      } else if (this.otpConfirmed) {
        // User verified with OTP, start at shipping info step
        console.log('OTP confirmed, setting step to 1 (shipping)');
        this.step = 1;
      } else {
        // User is not logged in and not verified with OTP, start at verification step
        console.log('User not authenticated and OTP not confirmed, setting step to 0 (verification)');
        this.step = 0;
        this.otpVerificationInProgress = true;
      }
    });
  }
  
  // Ionic lifecycle hook - will be called each time the view becomes active
  ionViewWillEnter() {
    console.log('Checkout page entered - checking authentication status');
    
    // Check authentication state when view enters
    this.checkAuthStatus();
    
    // If user is authenticated, make sure step is set correctly
    if ((this.jwtAuthService.isAuthenticated || this.authService.isLoggedIn) && this.step === 0) {
      console.log('User is authenticated but step is 0, updating to step 1');
      this.step = 1;
    }
    
    // If cart is empty and no payment ID in URL, redirect to cart page
    if (!this.paymentId && (!this.cart?.items || this.cart?.items.length === 0)) {
      console.log('Cart is empty, redirecting to cart page');
      this.router.navigate(['/cart']);
    }
    
    // If step is 0 (verification) and we have a valid phone number but OTP verification 
    // isn't in progress, show the phone input alert
    if (this.step === 0 && !this.otpVerificationInProgress) {
      const phoneControl = this.shippingForm.get('phone');
      if (!phoneControl || !phoneControl.valid) {
        console.log('Phone not valid, showing phone input alert');
        setTimeout(() => {
          this.showPhoneInputAlert();
        }, 500);
      }
    }
  }
  
  // Check authentication status and show OTP verification if needed
  checkAuthStatus() {
    // Check if user is authenticated with either JWT or legacy auth
    if (!this.jwtAuthService.isAuthenticated && !this.authService.isLoggedIn && !this.otpConfirmed) {
      // User is not logged in with any method and OTP is not confirmed, show OTP verification
      console.log('User not authenticated and OTP not confirmed, showing auth options');
      setTimeout(() => {
        this.showAuthOptions();
      }, 500); // Small delay to ensure everything is loaded
    } else {
      console.log('User is authenticated:', 
        this.jwtAuthService.isAuthenticated ? 'via JWT' : 
        this.authService.isLoggedIn ? 'via legacy auth' : 'via OTP');
    }
  }
  
  // Show authentication options for non-logged-in users
  async showAuthOptions() {
    const alert = await this.alertController.create({
      header: 'التحقق من الهوية',
      message: 'يرجى تسجيل الدخول أو التحقق من رقم هاتفك للمتابعة',
      backdropDismiss: false,
      buttons: [
        {
          text: 'تسجيل الدخول',
          handler: () => {
            // Redirect to login page with return URL
            this.router.navigate(['/login'], { 
              queryParams: { returnUrl: '/checkout' } 
            });
          }
        },
        {
          text: 'التحقق بواسطة OTP',
          handler: () => {
            // Start OTP verification process
            this.otpVerificationInProgress = true;
            
            // Get phone from form if available
            const phoneControl = this.shippingForm.get('phone');
            if (phoneControl && phoneControl.valid) {
              this.sendOtp();
            } else {
              // Show phone input alert
              this.showPhoneInputAlert();
            }
          }
        }
      ]
    });

    await alert.present();
  }
  
  // Show phone input alert for OTP verification
  async showPhoneInputAlert() {
    const alert = await this.alertController.create({
      header: 'أدخل رقم الهاتف',
      message: 'سيتم إرسال رمز التحقق إلى هذا الرقم',
      inputs: [
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'رقم الهاتف (بدون 0)'
        }
      ],
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          handler: () => {
            this.otpVerificationInProgress = false;
          }
        },
        {
          text: 'إرسال',
          handler: (data) => {
            if (data.phone && data.phone.length >= 9) {
              // Update phone in shipping form
              const phoneControl = this.shippingForm.get('phone');
              if (phoneControl) {
                phoneControl.setValue(data.phone);
              }
              
              // Send OTP
              this.sendOtp();
            } else {
              this.presentToast('يرجى إدخال رقم هاتف صحيح', 'danger');
              return false; // Keep the alert open
            }
          }
        }
      ]
    });

    await alert.present();
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
      district: ['', [Validators.required]], // Added district field
      city: ['', [Validators.required]],
      state: ['', [Validators.required]],
      postalCode: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      country: ['SA', [Validators.required]], // Default to Saudi Arabia
      notes: ['']
    });
  }

  // Load user data if logged in
  loadUserData() {
    this.isLoading = true;
    
    // First check JWT auth service (our primary auth method)
    if (this.jwtAuthService.isAuthenticated && this.jwtAuthService.currentUserValue) {
      const jwtUser = this.jwtAuthService.currentUserValue;
      this.user = jwtUser;
      
      // Load saved addresses
      this.loadSavedAddresses();
      
      // Pre-fill form with JWT user data
      this.shippingForm.patchValue({
        firstName: jwtUser.first_name || '',
        lastName: jwtUser.last_name || '',
        email: jwtUser.email || '',
        phone: jwtUser.billing?.phone || '',
        address1: jwtUser.shipping?.address_1 || '',
        address2: jwtUser.shipping?.address_2 || '',
        district: jwtUser.shipping?.company || '', // Use company field as district
        city: jwtUser.shipping?.city || '',
        state: jwtUser.shipping?.state || '',
        postalCode: jwtUser.shipping?.postcode || '',
        country: jwtUser.shipping?.country || 'SA'
      });
      
      this.isLoading = false;
      return;
    }
    
    // Fallback to legacy auth service if JWT auth not available
    this.userSubscription = this.authService.user.subscribe(user => {
      if (user) {
        this.user = user;
        
        // Load saved addresses
        this.loadSavedAddresses();
        
        // Pre-fill form with user data if available
        this.shippingForm.patchValue({
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          email: user.email || '',
          phone: user.billing?.phone || '',
          address1: user.shipping?.address_1 || '',
          address2: user.shipping?.address_2 || '',
          district: user.shipping?.company || '', // Use company field as district
          city: user.shipping?.city || '',
          state: user.shipping?.state || '',
          postalCode: user.shipping?.postcode || '',
          country: user.shipping?.country || 'SA'
        });
      }
      
      this.isLoading = false;
    });
  }
  
  // Load saved addresses from user metadata
  loadSavedAddresses() {
    if (!this.user || !this.user.meta_data) {
      this.savedAddresses = [];
      return;
    }
    
    // Find saved addresses in user metadata
    const savedAddressesMeta = this.user.meta_data.find(
      meta => meta.key === 'saved_shipping_addresses'
    );
    
    if (savedAddressesMeta && Array.isArray(savedAddressesMeta.value)) {
      this.savedAddresses = savedAddressesMeta.value;
      
      // Add default address if not present
      const hasDefault = this.savedAddresses.some(address => address.isDefault);
      if (!hasDefault && this.user.shipping && this.user.shipping.address_1) {
        // Create default address from user shipping info
        const defaultAddress = {
          id: 0, // Use ID 0 for default address
          isDefault: true,
          first_name: this.user.first_name || '',
          last_name: this.user.last_name || '',
          company: this.user.shipping.company || '',
          address_1: this.user.shipping.address_1 || '',
          address_2: this.user.shipping.address_2 || '',
          city: this.user.shipping.city || '',
          state: this.user.shipping.state || '',
          postcode: this.user.shipping.postcode || '',
          country: this.user.shipping.country || 'SA',
          phone: this.user.billing?.phone || ''
        };
        
        this.savedAddresses.unshift(defaultAddress);
        this.selectedAddressId = 0;
      } else if (this.savedAddresses.length > 0) {
        // Select the default address or the first one
        const defaultAddress = this.savedAddresses.find(address => address.isDefault);
        this.selectedAddressId = defaultAddress ? defaultAddress.id : this.savedAddresses[0].id;
      }
    } else {
      // No saved addresses, create one from the user's shipping info
      if (this.user.shipping && this.user.shipping.address_1) {
        const defaultAddress = {
          id: 0,
          isDefault: true,
          first_name: this.user.first_name || '',
          last_name: this.user.last_name || '',
          company: this.user.shipping.company || '',
          address_1: this.user.shipping.address_1 || '',
          address_2: this.user.shipping.address_2 || '',
          city: this.user.shipping.city || '',
          state: this.user.shipping.state || '',
          postcode: this.user.shipping.postcode || '',
          country: this.user.shipping.country || 'SA',
          phone: this.user.billing?.phone || ''
        };
        
        this.savedAddresses = [defaultAddress];
        this.selectedAddressId = 0;
      } else {
        this.savedAddresses = [];
      }
    }
  }
  
  // Select a saved address
  selectSavedAddress(address: any) {
    this.selectedAddressId = address.id;
    
    // Fill the form with the selected address data
    this.shippingForm.patchValue({
      firstName: address.first_name || '',
      lastName: address.last_name || '',
      email: this.shippingForm.get('email')?.value || '',
      address1: address.address_1 || '',
      address2: address.address_2 || '',
      district: address.company || '', // Use company field as district
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postcode || '',
      country: address.country || 'SA',
      phone: address.phone || ''
    });
    
    // Mark the form as touched to activate validation
    this.shippingForm.markAllAsTouched();
  }
  
  // Add a new address
  async addNewAddress() {
    // Show the address form in an alert
    const alert = await this.alertController.create({
      header: 'إضافة عنوان جديد',
      inputs: [
        {
          name: 'first_name',
          type: 'text',
          placeholder: 'الاسم الأول',
          value: this.shippingForm.get('firstName')?.value || ''
        },
        {
          name: 'last_name',
          type: 'text',
          placeholder: 'الاسم الأخير',
          value: this.shippingForm.get('lastName')?.value || ''
        },
        {
          name: 'address_1',
          type: 'text',
          placeholder: 'العنوان 1',
          value: ''
        },
        {
          name: 'address_2',
          type: 'text',
          placeholder: 'العنوان 2 (اختياري)',
          value: ''
        },
        {
          name: 'district',
          type: 'text',
          placeholder: 'الحي',
          value: ''
        },
        {
          name: 'city',
          type: 'text',
          placeholder: 'المدينة',
          value: ''
        },
        {
          name: 'state',
          type: 'text',
          placeholder: 'المنطقة',
          value: ''
        },
        {
          name: 'postcode',
          type: 'text',
          placeholder: 'الرمز البريدي',
          value: ''
        },
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'رقم الهاتف',
          value: this.shippingForm.get('phone')?.value || ''
        }
      ],
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حفظ',
          handler: (data) => {
            // Validate required fields
            if (!data.first_name || !data.last_name || !data.address_1 || !data.district ||
                !data.city || !data.state || !data.postcode || !data.phone) {
              this.presentToast('يرجى ملء جميع الحقول المطلوبة', 'danger');
              return false;
            }
            
            // Create new address object
            const newAddress = {
              id: Date.now(), // Use timestamp as unique ID
              isDefault: this.savedAddresses.length === 0,
              first_name: data.first_name,
              last_name: data.last_name,
              address_1: data.address_1,
              address_2: data.address_2 || '',
              company: data.district || '', // Store district in company field
              city: data.city,
              state: data.state,
              postcode: data.postcode,
              country: 'SA', // Default to Saudi Arabia
              phone: data.phone
            };
            
            // Add to saved addresses and save to user metadata
            this.savedAddresses.push(newAddress);
            this.saveAddressesToUser();
            
            // Select the new address
            this.selectSavedAddress(newAddress);
            
            this.presentToast('تم إضافة العنوان بنجاح', 'success');
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  // Edit an existing address
  async editAddress(address: any) {
    const alert = await this.alertController.create({
      header: 'تعديل العنوان',
      inputs: [
        {
          name: 'first_name',
          type: 'text',
          placeholder: 'الاسم الأول',
          value: address.first_name || ''
        },
        {
          name: 'last_name',
          type: 'text',
          placeholder: 'الاسم الأخير',
          value: address.last_name || ''
        },
        {
          name: 'address_1',
          type: 'text',
          placeholder: 'العنوان 1',
          value: address.address_1 || ''
        },
        {
          name: 'address_2',
          type: 'text',
          placeholder: 'العنوان 2 (اختياري)',
          value: address.address_2 || ''
        },
        {
          name: 'district',
          type: 'text',
          placeholder: 'الحي',
          value: address.company || '' // Get district from company field
        },
        {
          name: 'city',
          type: 'text',
          placeholder: 'المدينة',
          value: address.city || ''
        },
        {
          name: 'state',
          type: 'text',
          placeholder: 'المنطقة',
          value: address.state || ''
        },
        {
          name: 'postcode',
          type: 'text',
          placeholder: 'الرمز البريدي',
          value: address.postcode || ''
        },
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'رقم الهاتف',
          value: address.phone || ''
        }
      ],
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حفظ',
          handler: (data) => {
            // Validate required fields
            if (!data.first_name || !data.last_name || !data.address_1 || !data.district ||
                !data.city || !data.state || !data.postcode || !data.phone) {
              this.presentToast('يرجى ملء جميع الحقول المطلوبة', 'danger');
              return false;
            }
            
            // Update address data
            const index = this.savedAddresses.findIndex(a => a.id === address.id);
            if (index !== -1) {
              // Preserve the ID and isDefault status
              const isDefault = this.savedAddresses[index].isDefault;
              
              this.savedAddresses[index] = {
                ...this.savedAddresses[index],
                first_name: data.first_name,
                last_name: data.last_name,
                address_1: data.address_1,
                address_2: data.address_2 || '',
                company: data.district || '', // Store district in company field
                city: data.city,
                state: data.state,
                postcode: data.postcode,
                country: this.savedAddresses[index].country || 'SA',
                phone: data.phone
              };
              
              // Save to user metadata
              this.saveAddressesToUser();
              
              // If this was the selected address, update the form
              if (this.selectedAddressId === address.id) {
                this.selectSavedAddress(this.savedAddresses[index]);
              }
              
              this.presentToast('تم تحديث العنوان بنجاح', 'success');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  // Delete an address
  async deleteAddress(address: any) {
    // Confirm deletion
    const alert = await this.alertController.create({
      header: 'حذف العنوان',
      message: 'هل أنت متأكد من أنك تريد حذف هذا العنوان؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حذف',
          handler: () => {
            // Don't allow deleting the default address
            if (address.isDefault) {
              this.presentToast('لا يمكن حذف العنوان الافتراضي', 'danger');
              return;
            }
            
            // Remove from saved addresses
            const index = this.savedAddresses.findIndex(a => a.id === address.id);
            if (index !== -1) {
              this.savedAddresses.splice(index, 1);
              
              // Save to user metadata
              this.saveAddressesToUser();
              
              // If this was the selected address, select the default one
              if (this.selectedAddressId === address.id) {
                const defaultAddress = this.savedAddresses.find(a => a.isDefault);
                if (defaultAddress) {
                  this.selectSavedAddress(defaultAddress);
                } else if (this.savedAddresses.length > 0) {
                  this.selectSavedAddress(this.savedAddresses[0]);
                }
              }
              
              this.presentToast('تم حذف العنوان بنجاح', 'success');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  // Set an address as default
  setDefaultAddress(address: any) {
    // Update isDefault flag for all addresses
    this.savedAddresses.forEach(a => {
      a.isDefault = a.id === address.id;
    });
    
    // Save to user metadata
    this.saveAddressesToUser();
    
    // Select this address
    this.selectSavedAddress(address);
    
    this.presentToast('تم تعيين العنوان كعنوان افتراضي', 'success');
  }
  
  // Save addresses to user metadata
  saveAddressesToUser() {
    if (!this.user || !this.user.meta_data) return;
    
    // Find the saved addresses metadata
    const index = this.user.meta_data.findIndex(meta => meta.key === 'saved_shipping_addresses');
    
    if (index !== -1) {
      // Update existing metadata
      this.user.meta_data[index].value = this.savedAddresses;
    } else {
      // Add new metadata
      this.user.meta_data.push({
        id: Date.now(),
        key: 'saved_shipping_addresses',
        value: this.savedAddresses
      });
    }
    
    // If user is logged in, update the user profile
    if (this.authService.isLoggedIn) {
      this.authService.updateUserProfile(this.user).subscribe(
        updatedUser => {
          console.log('User profile updated with new addresses');
        },
        error => {
          console.error('Error updating user profile:', error);
          // We still keep the addresses locally even if the API update fails
        }
      );
    }
  }
  
  // Get country name from code
  getCountryName(countryCode: string): string {
    const countries = {
      'SA': 'المملكة العربية السعودية',
      'AE': 'الإمارات العربية المتحدة',
      'BH': 'البحرين',
      'KW': 'الكويت',
      'OM': 'عُمان',
      'QA': 'قطر'
    };
    
    return countries[countryCode] || countryCode;
  }

  // Process to next step
  nextStep() {
    if (this.step === 1) {
      if (this.shippingForm.valid) {
        this.step = 2; // Move to payment method selection
      } else {
        this.markFormGroupTouched(this.shippingForm);
        this.presentToast('يرجى إكمال جميع الحقول المطلوبة', 'danger');
      }
    } else if (this.step === 2) {
      // Payment method selected - handle based on payment type
      switch (this.paymentMethod) {
        case 'creditCard':
          // For credit card, open the payment modal
          this.openCreditCardModal();
          break;
          
        case 'applePay':
          // For Apple Pay, verify device support first
          if (!this.paymentService.isApplePaySupported()) {
            this.presentToast('Apple Pay غير متوفر على هذا الجهاز', 'danger');
            return;
          }
          
          // Proceed to payment directly with Apple Pay
          this.processApplePayPayment();
          break;
          
        case 'stcPay':
          // For STC Pay, proceed directly to payment
          this.processSTCPayPayment();
          break;
          
        case 'cod':
        default:
          // For cash on delivery, verify user authentication if needed
          if (!this.jwtAuthService.isAuthenticated && !this.authService.isLoggedIn && !this.otpConfirmed) {
            // Neither JWT auth nor legacy auth is active and OTP not confirmed
            this.showAuthOptions();
          } else {
            // User is logged in (via any method) or OTP is confirmed, proceed to review
            this.step = 3;
          }
          break;
      }
    } else if (this.step === 3) {
      // Review step - proceed to place order
      this.placeOrder();
    }
  }

  // Back to previous step
  previousStep() {
    if (this.step > 1) {
      this.step--;
    }
  }

  // Handle payment method selection
  selectPaymentMethod(method: string) {
    this.paymentMethod = method;
    this.creditCardFormSubmitted = false; // Reset credit card form status when switching payment methods
  }
  
  // Credit card modal control functions
  async openCreditCardModal() {
    // Create custom style for the modal to make it smaller
    document.documentElement.style.setProperty('--payment-modal-height', '70%');
    this.showCreditCardModal = true;
  }
  
  closeCreditCardModal() {
    this.showCreditCardModal = false;
  }

  // Process credit card payment
  async processPayment() {
    // Open the credit card modal to collect payment information
    this.openCreditCardModal();
  }
  
  // Process Apple Pay payment
  async processApplePayPayment() {
    if (!this.shippingForm.valid) {
      this.presentToast('يرجى إكمال معلومات الشحن بشكل صحيح', 'danger');
      return;
    }
    
    try {
      const billingDetails = this.extractBillingDetailsFromForm();
      const result = await this.paymentService.processApplePay(this.cart, billingDetails);
      
      if (result.success) {
        // Store payment ID for order creation
        this.paymentId = result.transactionId || null;
        
        // Move to order confirmation step
        this.step = 4;
        
        // Create order in WooCommerce
        this.placeOrder();
      }
    } catch (error) {
      console.error('Apple Pay payment error:', error);
      this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
    }
  }
  
  // Process STC Pay payment
  async processSTCPayPayment() {
    if (!this.shippingForm.valid) {
      this.presentToast('يرجى إكمال معلومات الشحن بشكل صحيح', 'danger');
      return;
    }
    
    try {
      const billingDetails = this.extractBillingDetailsFromForm();
      const result = await this.paymentService.processSTCPay(this.cart, billingDetails);
      
      if (result.success) {
        // Store payment ID for order creation
        this.paymentId = result.transactionId || null;
        
        // Move to order confirmation step
        this.step = 4;
        
        // Create order in WooCommerce
        this.placeOrder();
      }
    } catch (error) {
      console.error('STC Pay payment error:', error);
      this.presentToast('حدث خطأ أثناء معالجة الدفع', 'danger');
    }
  }
  
  // Extract billing details from the form
  private extractBillingDetailsFromForm() {
    return {
      first_name: this.shippingForm.get('firstName')?.value || '',
      last_name: this.shippingForm.get('lastName')?.value || '',
      email: this.shippingForm.get('email')?.value || '',
      phone: this.shippingForm.get('phone')?.value || '',
      address_1: this.shippingForm.get('address1')?.value || '',
      address_2: this.shippingForm.get('address2')?.value || '',
      district: this.shippingForm.get('district')?.value || '',
      city: this.shippingForm.get('city')?.value || '',
      state: this.shippingForm.get('state')?.value || '',
      postcode: this.shippingForm.get('postalCode')?.value || '',
      country: this.shippingForm.get('country')?.value || 'SA'
    };
  }

  // Send OTP verification code
  async sendOtp() {
    const loading = await this.loadingController.create({
      message: 'جاري إرسال رمز التحقق...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    const phoneControl = this.shippingForm.get('phone');
    const phoneNumber = phoneControl ? phoneControl.value : '';
    
    this.otpService.sendOtp(phoneNumber).subscribe(
      async () => {
        loading.dismiss();
        this.otpVerificationInProgress = true;
        this.presentToast('تم إرسال رمز التحقق إلى رقم هاتفك', 'success');
      },
      async error => {
        loading.dismiss();
        console.error('Error sending OTP', error);
        this.presentToast('حدث خطأ أثناء إرسال رمز التحقق. الرجاء المحاولة مرة أخرى.', 'danger');
      }
    );
  }

  // Verify OTP code
  async verifyOtp() {
    if (!this.verificationCode || this.verificationCode.length !== 4) {
      this.presentToast('يرجى إدخال رمز التحقق المكون من 4 أرقام', 'danger');
      return;
    }
    
    const loading = await this.loadingController.create({
      message: 'جاري التحقق من الرمز...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    // Verify OTP
    const isValid = this.otpService.verifyOtp(this.verificationCode);
    
    if (isValid) {
      loading.dismiss();
      this.otpConfirmed = true;
      this.otpVerificationInProgress = false;
      
      // Proceed based on the current context
      if (this.step === 0) {
        // Initial verification before checkout
        this.step = 1; // Start with shipping info
      } else {
        // Verification during payment step
        this.step = 3; // Move to review step
      }
      
      this.presentToast('تم التحقق بنجاح', 'success');
    } else {
      loading.dismiss();
      this.presentToast('رمز التحقق غير صحيح. الرجاء المحاولة مرة أخرى.', 'danger');
    }
  }

  // Place order
  async placeOrder() {
    if (this.placingOrder) {
      return; // Prevent multiple submissions
    }
    
    this.placingOrder = true;
    
    const loading = await this.loadingController.create({
      message: 'جاري إتمام الطلب...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    try {
      // Get form controls
      const firstNameControl = this.shippingForm.get('firstName');
      const lastNameControl = this.shippingForm.get('lastName');
      const address1Control = this.shippingForm.get('address1');
      const address2Control = this.shippingForm.get('address2');
      const districtControl = this.shippingForm.get('district');
      const cityControl = this.shippingForm.get('city');
      const stateControl = this.shippingForm.get('state');
      const postalCodeControl = this.shippingForm.get('postalCode');
      const countryControl = this.shippingForm.get('country');
      const emailControl = this.shippingForm.get('email');
      const phoneControl = this.shippingForm.get('phone');
      const notesControl = this.shippingForm.get('notes');
      
      // Prepare order data
      let paymentMethod = 'cod'; // Default payment method
      let paymentTitle = 'الدفع عند الاستلام';
      let isPaid = false;
      let metaData = [];
      
      // Set payment method and title based on selected payment option
      switch (this.paymentMethod) {
        case 'creditCard':
          paymentMethod = 'moyasar_cc';
          paymentTitle = 'بطاقة ائتمان';
          isPaid = !!this.paymentId;
          metaData.push({ 
            key: 'moyasar_payment_id', 
            value: this.paymentId 
          });
          break;
          
        case 'applePay':
          paymentMethod = 'moyasar_applepay';
          paymentTitle = 'Apple Pay';
          isPaid = !!this.paymentId;
          metaData.push({ 
            key: 'moyasar_payment_id', 
            value: this.paymentId 
          });
          break;
          
        case 'stcPay':
          paymentMethod = 'moyasar_stcpay';
          paymentTitle = 'STC Pay';
          isPaid = !!this.paymentId;
          metaData.push({ 
            key: 'moyasar_payment_id', 
            value: this.paymentId 
          });
          break;
          
        default: // cod
          paymentMethod = 'cod';
          paymentTitle = 'الدفع عند الاستلام';
          isPaid = false;
          break;
      }
      
      const orderData = {
        payment_method: paymentMethod,
        payment_method_title: paymentTitle,
        set_paid: isPaid, // Mark as paid for online payments with transaction ID
        transaction_id: this.paymentId || '', // Include payment ID
        billing: {
          first_name: firstNameControl ? firstNameControl.value : '',
          last_name: lastNameControl ? lastNameControl.value : '',
          address_1: address1Control ? address1Control.value : '',
          address_2: address2Control ? address2Control.value : '',
          company: districtControl ? districtControl.value : '', // Using company field for district
          city: cityControl ? cityControl.value : '',
          state: stateControl ? stateControl.value : '',
          postcode: postalCodeControl ? postalCodeControl.value : '',
          country: countryControl ? countryControl.value : 'SA',
          email: emailControl ? emailControl.value : '',
          phone: phoneControl ? phoneControl.value : ''
        },
        shipping: {
          first_name: firstNameControl ? firstNameControl.value : '',
          last_name: lastNameControl ? lastNameControl.value : '',
          address_1: address1Control ? address1Control.value : '',
          address_2: address2Control ? address2Control.value : '',
          company: districtControl ? districtControl.value : '', // Using company field for district
          city: cityControl ? cityControl.value : '',
          state: stateControl ? stateControl.value : '',
          postcode: postalCodeControl ? postalCodeControl.value : '',
          country: countryControl ? countryControl.value : 'SA'
        },
        customer_note: notesControl ? notesControl.value : '',
        customer_id: this.jwtAuthService.currentUserValue?.id || (this.user ? this.user.id : 0),
        line_items: this.cart?.items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity
        })) || [],
        meta_data: metaData
      };
      
      this.orderService.createOrder(orderData).subscribe(
        async order => {
          this.orderId = order.id;
          
          // Payment completed or cash on delivery selected
          loading.dismiss();
          
          // Always go to the confirmation screen (step 4)
          this.step = 4;
          
          // Clear cart after successful order
          this.cartService.clearCart();
          this.placingOrder = false;
          
          // Show success message
          this.presentToast('تم إنشاء الطلب بنجاح', 'success');
          
          // Log for debugging
          console.log('Order created successfully:', order);
        },
        error => {
          loading.dismiss();
          console.error('Error creating order', error);
          this.presentToast('حدث خطأ أثناء إنشاء الطلب. الرجاء المحاولة مرة أخرى.', 'danger');
          this.placingOrder = false;
        }
      );
    } catch (error) {
      loading.dismiss();
      console.error('Exception during order placement:', error);
      this.presentToast('حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.', 'danger');
      this.placingOrder = false;
    }
  }

  // Go to orders page
  goToOrders() {
    this.router.navigate(['/account/orders']);
  }

  // Go back to shopping
  continueShopping() {
    this.router.navigate(['/home']);
  }

  // Handle successful payment from Moyasar
  handlePaymentSuccess(payment: any) {
    console.log('Payment successful:', payment);
    this.paymentId = payment.id;
    this.creditCardFormSubmitted = true;
    this.presentToast('تم الدفع بنجاح', 'success');
    
    // Close the modal
    this.showCreditCardModal = false;
    
    // Update order data with payment ID
    if (this.step === 2) {
      this.step = 3; // Proceed to review step
    }
  }
  
  // Handle failed payment from Moyasar
  handlePaymentFailure(error: any) {
    console.error('Payment failed:', error);
    this.presentToast('فشلت عملية الدفع: ' + error.message, 'danger');
    
    // Close the modal after error
    setTimeout(() => {
      this.showCreditCardModal = false;
    }, 1000);
  }
  
  // Handle payment callback from Moyasar
  async handlePaymentCallback(paymentId: string) {
    console.log('Payment callback received with ID:', paymentId);
    
    if (!paymentId) {
      return;
    }
    
    this.paymentId = paymentId;
    
    const loading = await this.loadingController.create({
      message: 'جاري التحقق من حالة الدفع...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    this.paymentService.verifyPayment(paymentId).subscribe(
      payment => {
        loading.dismiss();
        
        if (payment.status === 'paid' || payment.status === 'authorized') {
          // Payment successful
          this.presentToast('تم الدفع بنجاح', 'success');
          this.step = 4; // Move to confirmation step
          this.cartService.clearCart(); // Clear cart after successful payment
          
          // In a real app, we would update the order status here
          console.log('Order completed successfully with payment ID:', paymentId);
        } else {
          // Payment failed
          this.presentToast('فشلت عملية الدفع: ' + (payment.source?.message || 'خطأ غير معروف'), 'danger');
          this.step = 2; // Back to payment step
        }
      },
      error => {
        loading.dismiss();
        console.error('Error verifying payment:', error);
        this.presentToast('حدث خطأ أثناء التحقق من حالة الدفع', 'danger');
        this.step = 2; // Back to payment step
      }
    );
  }
  
  // Generate a temporary order number for display purposes
  getTempOrderNumber(): string {
    // Generate a random order number for display in the payment form
    return 'TMP' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }
  
  // Show toast message
  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: color
    });
    
    await toast.present();
  }

  // Mark all fields as touched to show validation errors
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  
  // Detect if Apple Pay is available based on Moyasar guidelines
  private detectApplePayAvailability(): boolean {
    // Check if we're running in a compatible browser environment
    if (typeof window === 'undefined' || !window.ApplePaySession) {
      return false;
    }
    
    try {
      // Check if Apple Pay is available with the device
      return window.ApplePaySession && window.ApplePaySession.canMakePayments();
    } catch (error) {
      console.error('Error detecting Apple Pay availability:', error);
      return false;
    }
  }
}