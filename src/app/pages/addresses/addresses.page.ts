import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController, AlertController, NavController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { AddressService, CustomAddress } from 'src/app/services/address.service';
import { JwtAuthService } from 'src/app/services/jwt-auth.service';
import { User } from 'src/app/interfaces/user.interface';
import { Address } from 'src/app/interfaces/address.interface';
import { Subscription, forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { AddressHelper } from 'src/app/helpers/address-helper';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.page.html',
  styleUrls: ['./addresses.page.scss']
})
export class AddressesPage implements OnInit, OnDestroy {
  addresses: Address[] = [];
  user: User | null = null;
  isLoading = true;
  showAddressForm = false;
  currentAddressType: 'shipping' | 'billing' = 'shipping';
  editingAddressId: string | number | null = null;
  addressForm: FormGroup;
  
  private userSubscription: Subscription | null = null;
  private addressesSubscription: Subscription | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private addressHelper: AddressHelper,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private navCtrl: NavController
  ) {
    // Create form with validation
    this.addressForm = this.formBuilder.group({
      name: ['', Validators.required],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      company: [''],
      address_1: ['', Validators.required],
      address_2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      postcode: ['', Validators.required],
      country: ['SA', Validators.required],
      email: ['', [Validators.email]],
      phone: [''],
      type: ['shipping'] // Hidden field to track the address type
    });
  }

  ngOnInit() {
    console.log('AddressesPage: Initializing');
    this.loadUserData();
    this.loadAddresses();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    
    if (this.addressesSubscription) {
      this.addressesSubscription.unsubscribe();
    }
  }

  /**
   * Load the current user information
   */
  private loadUserData() {
    this.userSubscription = this.jwtAuthService.getUserAsObservable().subscribe(
      (user) => {
        console.log('User data loaded:', user);
        this.user = user;
        
        // Check if user is authenticated and has a valid ID (greater than 0)
        if (!user || !user.id || user.id === 0) {
          console.log('User not authenticated or has invalid ID, cannot access addresses');
          this.presentLoginAlert();
        }
      },
      (error) => {
        console.error('Error loading user data:', error);
        this.presentLoginAlert();
      }
    );
  }

  /**
   * Load all addresses for the user
   */
  loadAddresses() {
    console.log('Loading addresses');
    this.isLoading = true;
    
    // Check if user has a valid ID
    if (!this.user || !this.user.id || this.user.id === 0) {
      console.log('User not authenticated or has invalid ID, cannot load addresses');
      this.isLoading = false;
      return;
    }
    
    this.addressesSubscription = this.addressHelper.getAllAddresses().pipe(
      catchError(error => {
        console.error('Error loading addresses:', error);
        return of([]);
      }),
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe(
      (addresses) => {
        console.log('Addresses loaded:', addresses);
        this.addresses = addresses as Address[];
        
        if (this.addresses.length === 0 && this.user && this.user.id) {
          console.log('No addresses found for authenticated user');
        }
      }
    );
  }

  /**
   * Refresh addresses from the server
   */
  refreshAddresses(event?: any) {
    // First ensure user is authenticated and has a valid ID
    if (!this.jwtAuthService.isAuthenticated || !this.user || !this.user.id || this.user.id === 0) {
      console.log('User not authenticated or has invalid ID, cannot refresh addresses');
      if (event) event.target.complete();
      // Present login alert if this was a manual refresh
      if (!event) {
        this.presentLoginAlert();
      }
      return;
    }
    
    this.addressHelper.refreshAddresses().pipe(
      finalize(() => {
        if (event) event.target.complete();
      })
    ).subscribe(
      (addresses) => {
        console.log('Addresses refreshed:', addresses);
        this.addresses = addresses as Address[];
      },
      (error) => {
        console.error('Error refreshing addresses:', error);
        this.presentToast('فشل في تحديث العناوين', 'danger');
      }
    );
  }

  /**
   * Open the form to add a new address
   */
  openAddressForm(type: 'shipping' | 'billing') {
    // Check if user is authenticated and has a valid ID
    if (!this.jwtAuthService.isAuthenticated || !this.user || !this.user.id || this.user.id === 0) {
      console.log('User not authenticated or has invalid ID, cannot open address form');
      this.presentLoginAlert();
      return;
    }
    
    this.currentAddressType = type;
    this.editingAddressId = null;
    this.addressForm.reset();
    
    // Set default values
    this.addressForm.patchValue({
      name: type === 'shipping' ? 'عنوان الشحن' : 'عنوان الفواتير',
      country: 'SA',
      type: type,
      first_name: this.user?.first_name || '',
      last_name: this.user?.last_name || '',
      email: type === 'billing' ? this.user?.email || '' : '',
      phone: type === 'billing' ? this.user?.billing?.phone || '' : ''
    });
    
    this.showAddressForm = true;
  }

  /**
   * Open the form to edit an existing address
   */
  editAddress(address: Address) {
    // Check if user is authenticated and has a valid ID
    if (!this.jwtAuthService.isAuthenticated || !this.user || !this.user.id || this.user.id === 0) {
      console.log('User not authenticated or has invalid ID, cannot edit address');
      this.presentLoginAlert();
      return;
    }
    
    if (!address.type) {
      this.presentToast('نوع العنوان غير محدد', 'danger');
      return;
    }
    
    this.currentAddressType = address.type;
    this.editingAddressId = address.id;
    
    // Reset form and patch with address data
    this.addressForm.reset();
    this.addressForm.patchValue({
      ...address,
      type: address.type
    });
    
    this.showAddressForm = true;
  }

  /**
   * Cancel the address form
   */
  cancelAddressForm() {
    this.showAddressForm = false;
    this.editingAddressId = null;
    this.addressForm.reset();
  }

  /**
   * Save the address (create or update)
   */
  saveAddress() {
    // Validate the form
    if (!this.addressForm.valid) {
      // Mark all controls as touched to show validation errors
      Object.keys(this.addressForm.controls).forEach(key => {
        const control = this.addressForm.get(key);
        control?.markAsTouched();
      });
      
      this.presentToast('يرجى ملء جميع الحقول المطلوبة', 'danger');
      return;
    }
    
    // Check if user is authenticated and has a valid ID
    if (!this.jwtAuthService.isAuthenticated || !this.user || !this.user.id || this.user.id === 0) {
      console.log('User not authenticated or has invalid ID, cannot save address');
      this.presentLoginAlert();
      return;
    }
    
    // Show loading indicator
    this.loadingCtrl.create({
      message: 'جاري حفظ العنوان...',
      spinner: 'crescent'
    }).then(loading => {
      loading.present();
      
      const formData = this.addressForm.value;
      const type = formData.type;
      
      // Create a complete address object
      const address: Address = {
        ...formData,
        type: type,
        is_default: true
      };
      
      // If editing, add the ID to the address
      if (this.editingAddressId) {
        address.id = this.editingAddressId;
      }
      
      // Save the address using the helper
      this.addressHelper.saveAddress(address).pipe(
        finalize(() => {
          loading.dismiss();
        })
      ).subscribe(
        () => {
          const message = this.editingAddressId ? 'تم تحديث العنوان بنجاح' : 'تم إضافة العنوان بنجاح';
          this.presentToast(message, 'success');
          
          // Close form and refresh addresses
          this.showAddressForm = false;
          this.editingAddressId = null;
          this.addressForm.reset();
          this.loadAddresses();
        },
        (error) => {
          console.error('Error saving address:', error);
          this.presentToast('حدث خطأ أثناء حفظ العنوان', 'danger');
        }
      );
    });
  }

  /**
   * Set an address as the default for checkout
   */
  setDefaultAddress(address: Address) {
    // Check if user is authenticated and has a valid ID
    if (!this.jwtAuthService.isAuthenticated || !this.user || !this.user.id || this.user.id === 0) {
      console.log('User not authenticated or has invalid ID, cannot set default address');
      this.presentLoginAlert();
      return;
    }
    
    if (!address.id) {
      this.presentToast('معرف العنوان غير محدد', 'danger');
      return;
    }
    
    this.loadingCtrl.create({
      message: 'جاري تعيين العنوان الافتراضي...',
      spinner: 'crescent'
    }).then(loading => {
      loading.present();
      
      this.addressHelper.setDefaultAddress(address.id).pipe(
        finalize(() => {
          loading.dismiss();
        })
      ).subscribe(
        () => {
          this.presentToast('تم تعيين العنوان الافتراضي بنجاح', 'success');
          this.loadAddresses();
        },
        (error) => {
          console.error('Error setting default address:', error);
          this.presentToast('حدث خطأ أثناء تعيين العنوان الافتراضي', 'danger');
        }
      );
    });
  }

  /**
   * Delete an address
   */
  deleteAddress(address: Address) {
    // Check if user is authenticated and has a valid ID
    if (!this.jwtAuthService.isAuthenticated || !this.user || !this.user.id || this.user.id === 0) {
      console.log('User not authenticated or has invalid ID, cannot delete address');
      this.presentLoginAlert();
      return;
    }
    
    if (!address.id) {
      this.presentToast('معرف العنوان غير محدد', 'danger');
      return;
    }
    
    // Don't allow deletion of default addresses
    if (address.is_default) {
      this.presentToast('لا يمكن حذف العنوان الافتراضي', 'warning');
      return;
    }
    
    // Primary addresses cannot be deleted
    if (address.id === 'billing' || address.id === 'shipping') {
      this.presentToast('لا يمكن حذف العنوان الأساسي', 'warning');
      return;
    }
    
    // Show confirmation alert
    this.alertCtrl.create({
      header: 'تأكيد الحذف',
      message: 'هل أنت متأكد من رغبتك في حذف هذا العنوان؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حذف',
          handler: () => {
            this.loadingCtrl.create({
              message: 'جاري حذف العنوان...',
              spinner: 'crescent'
            }).then(loading => {
              loading.present();
              
              this.addressHelper.deleteAddress(address.id).pipe(
                finalize(() => {
                  loading.dismiss();
                })
              ).subscribe(
                () => {
                  this.presentToast('تم حذف العنوان بنجاح', 'success');
                  this.loadAddresses();
                },
                (error) => {
                  console.error('Error deleting address:', error);
                  this.presentToast('حدث خطأ أثناء حذف العنوان', 'danger');
                }
              );
            });
          }
        }
      ]
    }).then(alert => alert.present());
  }

  /**
   * Present a login alert when user tries to access addresses without authentication
   */
  async presentLoginAlert() {
    const alert = await this.alertCtrl.create({
      header: 'تنبيه',
      message: 'يجب تسجيل الدخول أولاً للوصول إلى العناوين',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          handler: () => {
            // Go back to previous page
            this.navCtrl.back();
          }
        },
        {
          text: 'تسجيل الدخول',
          handler: () => {
            // Navigate to login page
            this.navCtrl.navigateForward('/login');
          }
        }
      ]
    });
    
    await alert.present();
  }

  /**
   * Present a toast message
   */
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
      cssClass: 'toast-custom'
    });
    
    await toast.present();
  }

  /**
   * Check if a form field is invalid
   */
  isFieldInvalid(field: string): boolean {
    const control = this.addressForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
