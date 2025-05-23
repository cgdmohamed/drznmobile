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
import { CheckoutStep } from '../../components/checkout-steps/checkout-steps.component';


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
  
  // New multi-step checkout flow
  step = 0; // 0: initial, 1: shipping, 2: payment, 3: review, 4: confirmation
  currentStep: CheckoutStep = 'shipping';
  isLoading = true;
  
  // Shipping address
  selectedShippingAddress: any = null;
  
  // Verification and order states
  otpConfirmed = false;
  otpVerificationInProgress = false;
  verificationCode = '';
  placingOrder = false;
  orderId: number | null = null;
  
  // Payment state
  showCreditCardModal = false;
  paymentId: string | null = null;
  creditCardFormSubmitted = false;
  isApplePayAvailable = false;
  isStcPaySelected = false;
  phoneNumber: string = '';
  showCreditCardForm = false;
  creditCardHolderName: string = '';
  creditCardNumber: string = '';
  creditCardExpiry: string = '';
  creditCardCvc: string = '';
  
  // Address management
  savedAddresses: any[] = [];
  selectedAddressId: string | number | null = null;
  
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
    private addressService: AddressService, // Added Address service
    private addressHelper: AddressHelper, // Added AddressHelper service
    private router: Router,
    private route: ActivatedRoute,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController
  ) { 
    console.log('Checkout page initialized');
  }

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
  
  // Load saved addresses using the AddressHelper
  loadSavedAddresses() {
    console.log('Loading saved addresses from the AddressHelper service');
    const loading = this.loadingController.create({
      message: 'جاري تحميل العناوين...',
      spinner: 'crescent'
    });
    
    loading.then(loader => {
      loader.present();
      
      this.addressHelper.getAllAddresses().subscribe(
        (addresses) => {
          console.log('Addresses received from helper:', addresses);
          this.savedAddresses = [];
          
          // Transform addresses for UI display
          addresses.forEach(address => {
            const formattedAddress: any = {
              ...address,
              isDefault: address.is_default || false,
              // Make sure 'id' field is preserved
              id: address.id || (address.type === 'billing' ? 'billing' : 'shipping')
            };
            
            // Ensure the standard addresses have the correct IDs
            if (address.type === 'billing' && address.id !== 'billing') {
              formattedAddress.id = 'billing';
            } else if (address.type === 'shipping' && address.id !== 'shipping') {
              formattedAddress.id = 'shipping';
            }
            
            console.log(`Adding ${address.type} address to saved addresses:`, formattedAddress);
            this.savedAddresses.push(formattedAddress);
          });
          
          // Sort addresses - put default first, then sort by type (billing, shipping, then custom)
          this.savedAddresses.sort((a, b) => {
            // Default addresses first
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            
            // Then by type
            if (a.type === 'billing' && b.type !== 'billing') return -1;
            if (a.type !== 'billing' && b.type === 'billing') return 1;
            if (a.type === 'shipping' && b.type !== 'shipping') return -1;
            if (a.type !== 'shipping' && b.type === 'shipping') return 1;
            
            return 0;
          });
          
          // Select shipping address by default if available, otherwise select billing
          if (this.savedAddresses.length > 0) {
            // Try to select default address first
            const defaultAddress = this.savedAddresses.find(addr => addr.isDefault);
            if (defaultAddress) {
              this.selectedAddressId = defaultAddress.id;
            } else {
              // No default, try shipping then billing
              const shippingAddress = this.savedAddresses.find(addr => addr.type === 'shipping');
              this.selectedAddressId = shippingAddress ? shippingAddress.id : this.savedAddresses[0].id;
            }
            console.log('Selected address ID:', this.selectedAddressId);
          }
          
          // If no addresses found but we have user data, create temporary addresses from user profile
          if (this.savedAddresses.length === 0 && this.user) {
            console.log('No addresses found from API, creating from user profile');
            
            // Add billing address from user profile if available
            if (this.user.billing && this.user.billing.first_name) {
              const billingAddress: any = {
                ...this.user.billing,
                type: 'billing',
                isDefault: true,
                id: 'billing'
              };
              console.log('Adding billing address from user profile:', billingAddress);
              this.savedAddresses.push(billingAddress);
            }
            
            // Add shipping address from user profile if available
            if (this.user.shipping && this.user.shipping.first_name) {
              const shippingAddress: any = {
                ...this.user.shipping,
                type: 'shipping',
                isDefault: true,
                id: 'shipping'
              };
              console.log('Adding shipping address from user profile:', shippingAddress);
              this.savedAddresses.push(shippingAddress);
              this.selectedAddressId = 'shipping';
            } else if (this.savedAddresses.length > 0) {
              this.selectedAddressId = 'billing';
            }
          }
          
          console.log('Final saved addresses:', this.savedAddresses);
          loader.dismiss();
        },
        error => {
          console.error('Error loading addresses:', error);
          
          // Fallback to user profile data if address service fails
          if (this.user) {
            console.log('Falling back to user profile for addresses');
            this.savedAddresses = [];
            
            // Add billing address from user profile if available
            if (this.user.billing && this.user.billing.first_name) {
              const billingAddress: any = {
                ...this.user.billing,
                type: 'billing',
                isDefault: true,
                id: 'billing'
              };
              this.savedAddresses.push(billingAddress);
            }
            
            // Add shipping address from user profile if available
            if (this.user.shipping && this.user.shipping.first_name) {
              const shippingAddress: any = {
                ...this.user.shipping,
                type: 'shipping',
                isDefault: true,
                id: 'shipping'
              };
              this.savedAddresses.push(shippingAddress);
              this.selectedAddressId = 'shipping';
            } else if (this.savedAddresses.length > 0) {
              this.selectedAddressId = 'billing';
            }
          }
          
          loader.dismiss();
          this.presentToast('حدث خطأ أثناء تحميل العناوين', 'danger');
        }
      );
    });
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
            
            // Show loading indicator
            this.loadingController.create({
              message: 'جاري إضافة العنوان...',
              spinner: 'crescent'
            }).then(loading => {
              loading.present();
              
              // Create address object compatible with our API
              const newAddress: Address = {
                first_name: data.first_name,
                last_name: data.last_name,
                address_1: data.address_1,
                address_2: data.address_2 || '',
                company: data.district || '', // Store district in company field
                city: data.city,
                state: data.state,
                postcode: data.postcode,
                country: 'SA', // Default to Saudi Arabia
                phone: data.phone,
                email: this.user?.email || '',
                type: 'shipping', // Default to shipping address
                is_default: true
              };
              
              // Save to API using AddressHelper
              this.addressHelper.saveAddress(newAddress).subscribe(
                response => {
                  console.log('Address added successfully:', response);
                  
                  // Add to local addresses array with proper ID for UI
                  const addressForUI = {
                    ...newAddress,
                    id: 'shipping',
                    isDefault: true
                  };
                  
                  // Find and replace existing shipping address or add new one
                  const existingIndex = this.savedAddresses.findIndex(a => a.id === 'shipping' || a.type === 'shipping');
                  if (existingIndex >= 0) {
                    this.savedAddresses[existingIndex] = addressForUI;
                  } else {
                    this.savedAddresses.push(addressForUI);
                  }
                  
                  // Select the new address
                  this.selectSavedAddress(addressForUI);
                  
                  this.presentToast('تم إضافة العنوان بنجاح', 'success');
                  loading.dismiss();
                },
                error => {
                  console.error('Error adding address:', error);
                  this.presentToast('حدث خطأ أثناء إضافة العنوان', 'danger');
                  loading.dismiss();
                }
              );
            });
            
            return true;
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
            
            // Show loading indicator
            this.loadingController.create({
              message: 'جاري تحديث العنوان...',
              spinner: 'crescent'
            }).then(loading => {
              loading.present();
              
              // Check if this is a billing or shipping address
              const addressType = (address.id === 'billing' || address.type === 'billing') 
                ? 'billing' 
                : 'shipping';
              
              // Create address object compatible with our API
              const updatedAddress: Address = {
                ...address,
                first_name: data.first_name,
                last_name: data.last_name,
                address_1: data.address_1,
                address_2: data.address_2 || '',
                company: data.district || '', // Store district in company field
                city: data.city,
                state: data.state,
                postcode: data.postcode,
                country: address.country || 'SA',
                phone: data.phone,
                email: this.user?.email || '',
                type: addressType,
                is_default: true
              };
              
              // Update address in API using AddressHelper
              this.addressHelper.saveAddress(updatedAddress).subscribe(
                response => {
                  console.log(`${addressType} address updated successfully:`, response);
                  
                  // Update address in local array
                  const index = this.savedAddresses.findIndex(a => 
                    a.id === address.id || 
                    a.id === addressType || 
                    a.type === addressType
                  );
                  
                  if (index !== -1) {
                    // Create UI version of the address
                    const addressForUI = {
                      ...updatedAddress,
                      id: addressType,
                      isDefault: true
                    };
                    
                    this.savedAddresses[index] = addressForUI;
                    
                    // If this was the selected address, update the form
                    if (this.selectedAddressId === address.id || 
                        this.selectedAddressId === addressType) {
                      this.selectSavedAddress(addressForUI);
                    }
                  }
                  
                  this.presentToast('تم تحديث العنوان بنجاح', 'success');
                  loading.dismiss();
                },
                error => {
                  console.error(`Error updating ${addressType} address:`, error);
                  this.presentToast('حدث خطأ أثناء تحديث العنوان', 'danger');
                  loading.dismiss();
                }
              );
            });
            
            return true;
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  // Delete an address
  async deleteAddress(address: any) {
    // Note: We can't actually delete shipping or billing addresses through the WooCommerce API
    // We can only update them or set them to empty. For our UI, we'll just clear the fields.
    
    // Confirm deletion/clearing
    const alert = await this.alertController.create({
      header: 'إزالة العنوان',
      message: 'هل أنت متأكد من أنك تريد إزالة هذا العنوان؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'إزالة',
          handler: () => {
            // Don't allow removing the default address fully
            if (address.isDefault) {
              this.presentToast('لا يمكن إزالة العنوان الافتراضي', 'danger');
              return;
            }
            
            // For shipping/billing addresses, we'll just clear the fields instead of deleting
            if (address.id === 'shipping' || address.id === 'billing' || 
                address.type === 'shipping' || address.type === 'billing') {
              
              const addressType = (address.id === 'billing' || address.type === 'billing') 
                ? 'billing' 
                : 'shipping';
              
              // Show loading indicator
              this.loadingController.create({
                message: 'جاري إزالة العنوان...',
                spinner: 'crescent'
              }).then(loading => {
                loading.present();
                
                // Create an empty address but keep the user's email
                const emptyAddress: Address = {
                  first_name: '',
                  last_name: '',
                  address_1: '',
                  address_2: '',
                  company: '',
                  city: '',
                  state: '',
                  postcode: '',
                  country: 'SA',
                  phone: '',
                  email: this.user?.email || '',
                  type: addressType
                };
                
                // Update with empty values using AddressHelper
                this.addressHelper.saveAddress(emptyAddress).subscribe(
                  () => {
                    console.log(`${addressType} address cleared successfully`);
                    
                    // Remove from UI saved addresses
                    const index = this.savedAddresses.findIndex(a => 
                      a.id === address.id || 
                      a.id === addressType || 
                      a.type === addressType
                    );
                    
                    if (index !== -1) {
                      this.savedAddresses.splice(index, 1);
                    }
                    
                    // If this was the selected address, clear selection
                    if (this.selectedAddressId === address.id || 
                        this.selectedAddressId === addressType) {
                      this.selectedAddressId = null;
                      
                      // If we have other addresses, select one
                      if (this.savedAddresses.length > 0) {
                        this.selectSavedAddress(this.savedAddresses[0]);
                      }
                    }
                    
                    this.presentToast('تم إزالة العنوان بنجاح', 'success');
                    loading.dismiss();
                  },
                  error => {
                    console.error(`Error clearing ${addressType} address:`, error);
                    this.presentToast('حدث خطأ أثناء إزالة العنوان', 'danger');
                    loading.dismiss();
                  }
                );
              });
            } else {
              // For custom addresses, we can just remove from the local array
              // This is for backward compatibility and may not be needed with our new approach
              const index = this.savedAddresses.findIndex(a => a.id === address.id);
              if (index !== -1) {
                this.savedAddresses.splice(index, 1);
                
                // If this was the selected address, select another if available
                if (this.selectedAddressId === address.id) {
                  this.selectedAddressId = null;
                  
                  if (this.savedAddresses.length > 0) {
                    this.selectSavedAddress(this.savedAddresses[0]);
                  }
                }
                
                this.presentToast('تم إزالة العنوان بنجاح', 'success');
              }
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  // Set an address as default
  setDefaultAddress(address: any) {
    // For shipping/billing addresses, we'll set them as default through the API
    if (address.id === 'shipping' || address.id === 'billing' || 
        address.type === 'shipping' || address.type === 'billing') {
      
      const addressType = (address.id === 'billing' || address.type === 'billing') 
        ? 'billing' 
        : 'shipping';
      
      // Show loading indicator
      this.loadingController.create({
        message: 'جاري تعيين العنوان الافتراضي...',
        spinner: 'crescent'
      }).then(loading => {
        loading.present();
        
        // Update address with is_default flag
        const updatedAddress: Address = {
          ...address,
          type: addressType,
          is_default: true
        };
        
        this.addressHelper.setDefaultAddress(address.id).subscribe(
          () => {
            console.log(`${addressType} address set as default successfully`);
            
            // Update UI addresses
            this.savedAddresses.forEach(a => {
              a.isDefault = (a.id === address.id || a.id === addressType || a.type === addressType);
            });
            
            // Select this address
            this.selectSavedAddress(address);
            
            this.presentToast('تم تعيين العنوان كعنوان افتراضي', 'success');
            loading.dismiss();
          },
          error => {
            console.error(`Error setting ${addressType} address as default:`, error);
            this.presentToast('حدث خطأ أثناء تعيين العنوان الافتراضي', 'danger');
            loading.dismiss();
          }
        );
      });
    } else {
      // For custom addresses, update the local array
      // This is for backward compatibility and may not be needed with our new approach
      this.savedAddresses.forEach(a => {
        a.isDefault = a.id === address.id;
      });
      
      // Select this address
      this.selectSavedAddress(address);
      
      this.presentToast('تم تعيين العنوان كعنوان افتراضي', 'success');
    }
  }
  
  // Save addresses using the AddressHelper
  saveAddressesToUser() {
    console.log('Saving addresses using the AddressHelper service');
    
    // For each address in the savedAddresses array, save it to the API
    // The addresses created/edited in the UI will be custom addresses with generated IDs
    // We need to split them by type (billing/shipping) and save them to the proper endpoint
    
    // Find any updated billing/shipping addresses
    const billingAddress = this.savedAddresses.find(addr => addr.id === 'billing' || addr.type === 'billing');
    const shippingAddress = this.savedAddresses.find(addr => addr.id === 'shipping' || addr.type === 'shipping');
    
    // Show a loading indicator
    this.loadingController.create({
      message: 'جاري حفظ العناوين...',
      spinner: 'crescent'
    }).then(loading => {
      loading.present();
      
      let saveOperations = 0;
      let completedOperations = 0;
      
      // Function to check if all operations are complete
      const checkCompletion = () => {
        completedOperations++;
        if (completedOperations === saveOperations) {
          loading.dismiss();
          this.presentToast('تم حفظ العناوين بنجاح', 'success');
        }
      };
      
      if (billingAddress) {
        console.log('Saving billing address', billingAddress);
        saveOperations++;
        
        const addressToSave: Address = {
          ...billingAddress,
          type: 'billing',
          is_default: true
        };
        
        this.addressHelper.saveAddress(addressToSave).subscribe(
          () => {
            console.log('Billing address saved successfully');
            checkCompletion();
          },
          error => {
            console.error('Error saving billing address:', error);
            this.presentToast('حدث خطأ أثناء حفظ عنوان الفواتير', 'danger');
            loading.dismiss();
          }
        );
      }
      
      if (shippingAddress) {
        console.log('Saving shipping address', shippingAddress);
        saveOperations++;
        
        const addressToSave: Address = {
          ...shippingAddress,
          type: 'shipping',
          is_default: true
        };
        
        this.addressHelper.saveAddress(addressToSave).subscribe(
          () => {
            console.log('Shipping address saved successfully');
            checkCompletion();
          },
          error => {
            console.error('Error saving shipping address:', error);
            this.presentToast('حدث خطأ أثناء حفظ عنوان الشحن', 'danger');
            loading.dismiss();
          }
        );
      }
      
      // If no operations were scheduled, dismiss the loading indicator
      if (saveOperations === 0) {
        loading.dismiss();
      }
    });
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
          // For cash on delivery, always move forward regardless of authentication status
          // Authentication checks will happen in ionViewWillEnter via checkAuthStatus
          console.log('Cash on delivery selected, proceeding to review');
          this.step = 3; // Move to review step always
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
    if (!this.shippingForm.valid) {
      this.presentToast('يرجى إكمال معلومات الشحن بشكل صحيح', 'danger');
      return;
    }
    
    // Check authentication status only when we have valid form information
    if (!this.jwtAuthService.isAuthenticated && !this.authService.isLoggedIn && !this.otpConfirmed) {
      console.log('User not authenticated, showing auth options before Credit Card payment');
      this.showAuthOptions();
      return;
    }
    
    // Open the credit card modal to collect payment information
    this.openCreditCardModal();
  }
  
  // Process Apple Pay payment
  async processApplePayPayment() {
    if (!this.shippingForm.valid) {
      this.presentToast('يرجى إكمال معلومات الشحن بشكل صحيح', 'danger');
      return;
    }
    
    // Check authentication status only when we have valid form information
    if (!this.jwtAuthService.isAuthenticated && !this.authService.isLoggedIn && !this.otpConfirmed) {
      console.log('User not authenticated, showing auth options before Apple Pay payment');
      this.showAuthOptions();
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
    
    // Check authentication status only when we have valid form information
    if (!this.jwtAuthService.isAuthenticated && !this.authService.isLoggedIn && !this.otpConfirmed) {
      console.log('User not authenticated, showing auth options before STC Pay payment');
      this.showAuthOptions();
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
    
    try {
      // Get the phone number for verification
      const phoneNumber = this.getPhoneNumber();
      if (!phoneNumber) {
        throw new Error('رقم الهاتف غير متوفر للتحقق');
      }
      
      // Validate the OTP with updated service that takes phone number and code
      const response = await this.otpService.verifyOtp(phoneNumber, this.verificationCode);
      
      loading.dismiss();
      
      if (response && response.status === 'success') {
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
        // Show error message from API
        const errorMessage = response?.message || 'رمز التحقق غير صحيح. الرجاء المحاولة مرة أخرى.';
        this.presentToast(errorMessage, 'danger');
      }
    } catch (error) {
      loading.dismiss();
      console.error('Error verifying OTP:', error);
      this.presentToast('حدث خطأ أثناء التحقق، يرجى المحاولة مرة أخرى', 'danger');
    }
  }
  
  /**
   * Get the phone number for OTP verification
   * Try to get it from different sources depending on the context
   */
  private getPhoneNumber(): string | null {
    // Try to get from shipping form if available
    if (this.shippingForm && this.shippingForm.value.phone) {
      return this.shippingForm.value.phone;
    }
    
    // Try to get from user data if available
    if (this.user && this.user.billing && this.user.billing.phone) {
      return this.user.billing.phone;
    }
    
    // Try to get from selected shipping address if available
    if (this.selectedShippingAddress && this.selectedShippingAddress.phone) {
      return this.selectedShippingAddress.phone;
    }
    
    return null;
  }
  
  // Helper method to present toast messages
  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
      buttons: [
        {
          text: 'إغلاق',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
  
  // Helper to mark all controls in a form group as touched (for validation display)
  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
  
  // Check if Apple Pay is available
  detectApplePayAvailability(): boolean {
    if (typeof window === 'undefined' || !window.ApplePaySession) {
      return false;
    }
    
    try {
      return window.ApplePaySession && window.ApplePaySession.canMakePayments();
    } catch (e) {
      console.error('Error checking Apple Pay availability:', e);
      return false;
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
          console.error('Error creating order:', error);
          
          // Provide a more specific error message based on the error response
          let errorMessage = 'حدث خطأ أثناء إنشاء الطلب. الرجاء المحاولة مرة أخرى.';
          
          if (error.error && error.error.message) {
            console.log('API error message:', error.error.message);
            // Try to provide a more specific error based on the API response
            if (error.error.code === 'woocommerce_rest_cannot_create') {
              errorMessage = 'غير مسموح لك بإنشاء طلب. يرجى التأكد من تسجيل الدخول الصحيح.';
            } else if (error.error.message.includes('authentication')) {
              errorMessage = 'مشكلة في المصادقة. يرجى تسجيل الدخول مرة أخرى.';
            }
          } else if (error.status === 403) {
            errorMessage = 'غير مصرح لك بإنشاء طلب. قد تحتاج إلى تسجيل الدخول مرة أخرى.';
          } else if (error.status === 400) {
            errorMessage = 'بيانات الطلب غير صحيحة. يرجى التحقق من المعلومات المدخلة.';
          } else if (error.status === 0) {
            errorMessage = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';
          }
          
          this.presentToast(errorMessage, 'danger');
          this.placingOrder = false;
        }
      );
    } catch (error) {
      loading.dismiss();
      console.error('Exception during order placement:', error);
      
      // Provide more detailed error information for debugging
      if (error instanceof Error) {
        console.log('Error name:', error.name);
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
      }
      
      let errorMessage = 'حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.';
      
      // Try to provide a more helpful message based on the type of error
      if (error.message && error.message.includes('network')) {
        errorMessage = 'مشكلة في الاتصال بالإنترنت. يرجى التحقق من اتصالك والمحاولة مرة أخرى.';
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage = 'استغرقت العملية وقتًا طويلاً. يرجى المحاولة مرة أخرى.';
      }
      
      this.presentToast(errorMessage, 'danger');
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
  
  // Generate a temporary order number for display purposes
  getTempOrderNumber(): string {
    // Generate a random order number for display in the payment form
    return 'TMP' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
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
        
        // Provide more detailed error information for debugging
        if (error.error) {
          console.log('Error response data:', error.error);
        }
        
        let errorMessage = 'حدث خطأ أثناء التحقق من حالة الدفع';
        
        // Try to be more specific based on error type
        if (error.status === 0) {
          errorMessage = 'تعذر الاتصال بخدمة الدفع. يرجى التحقق من اتصالك بالإنترنت.';
        } else if (error.status === 404) {
          errorMessage = 'معرف الدفع غير موجود أو تم إلغاؤه.';
        } else if (error.status >= 500) {
          errorMessage = 'هناك مشكلة في خدمة الدفع. يرجى المحاولة مرة أخرى لاحقًا.';
        }
        
        this.presentToast(errorMessage, 'danger');
        this.step = 2; // Back to payment step
      }
    );
  }
  

}