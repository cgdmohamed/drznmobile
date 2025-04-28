import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { AddressService } from 'src/app/services/address.service';
import { JwtAuthService } from 'src/app/services/jwt-auth.service';
import { User } from 'src/app/interfaces/user.interface';
import { Address, AddressResponse, CustomAddress } from 'src/app/interfaces/address.interface';
import { Subscription, Observable, of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { AddressHelper } from 'src/app/helpers/address-helper';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.page.html',
  styleUrls: ['./addresses.page.scss'],
})
export class AddressesPage implements OnInit, OnDestroy {
  // Combined array of all addresses (billing, shipping and custom)
  addresses: Address[] = [];
  shippingAddresses: Address[] = []; // Filtered shipping addresses
  billingAddresses: Address[] = []; // Filtered billing addresses
  customAddresses: Address[] = []; // Filtered custom addresses
  
  user: User | null = null;
  isLoading = true;
  showAddressForm = false;
  currentAddressType: 'shipping' | 'billing' | 'custom' = 'shipping';
  editingAddressId: string | number | null = null;
  addressForm: FormGroup;
  
  private subscriptions: Subscription = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private addressService: AddressService,
    private addressHelper: AddressHelper,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    this.addressForm = this.formBuilder.group({
      address_nickname: [''], // For custom addresses
      name: [''], // For display purposes 
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
      type: ['custom'] // shipping, billing, or custom
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadData(): void {
    console.log('Loading addresses page data');
    this.isLoading = true;
    
    // Load user data
    const userSub = this.authService.user.subscribe(user => {
      this.user = user;
      console.log('User loaded from AuthService:', user);
    });
    this.subscriptions.add(userSub);
    
    // Initialize the address helper then get all addresses
    this.addressHelper.initialize();
    
    // Load all addresses (billing, shipping, and custom)
    const addressesSub = this.addressHelper.getAllAddresses()
      .pipe(
        tap(addresses => {
          console.log('All addresses loaded:', addresses);
          this.addresses = addresses;
          
          // Filter addresses by type
          this.filterAddresses();
        }),
        catchError(error => {
          console.error('Error loading addresses:', error);
          this.presentToast('فشل في تحميل العناوين', 'danger');
          return of([]);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe();
    
    this.subscriptions.add(addressesSub);
  }
  
  /**
   * Filter addresses by type
   */
  private filterAddresses(): void {
    // Clear existing filtered arrays
    this.shippingAddresses = [];
    this.billingAddresses = [];
    this.customAddresses = [];
    
    // Filter addresses by type
    this.addresses.forEach(address => {
      if (address.type === 'shipping') {
        this.shippingAddresses.push(address);
      } else if (address.type === 'billing') {
        this.billingAddresses.push(address);
      } else if (address.type === 'custom' || !address.type) {
        // Consider addresses with null/undefined type as custom
        this.customAddresses.push(address);
      }
    });
  }
  
  /**
   * Get shipping addresses
   */
  getShippingAddresses(): Address[] {
    return this.shippingAddresses;
  }
  
  /**
   * Get billing addresses
   */
  getBillingAddresses(): Address[] {
    return this.billingAddresses;
  }
  
  /**
   * Get custom addresses
   */
  getCustomAddresses(): Address[] {
    return this.customAddresses;
  }

  openAddressForm(type: 'shipping' | 'billing' | 'custom' = 'custom'): void {
    this.currentAddressType = type;
    this.editingAddressId = null;
    this.addressForm.reset();
    
    // Set default values
    this.addressForm.patchValue({
      address_nickname: type === 'custom' ? 'عنوان جديد' : (type === 'shipping' ? 'عنوان الشحن' : 'عنوان الفواتير'),
      name: type === 'custom' ? 'عنوان جديد' : (type === 'shipping' ? 'عنوان الشحن' : 'عنوان الفواتير'),
      country: 'SA',
      first_name: this.user?.first_name || '',
      last_name: this.user?.last_name || '',
      email: this.user?.email || '',
      phone: this.user?.billing?.phone || '',
      type: type
    });
    
    this.showAddressForm = true;
  }

  editAddress(address: Address): void {
    this.currentAddressType = address.type || 'custom';
    this.editingAddressId = address.id;
    this.addressForm.patchValue({
      ...address,
      address_nickname: address.address_nickname || address.name || '',
      name: address.name || address.address_nickname || ''
    });
    this.showAddressForm = true;
  }

  cancelAddressForm(): void {
    this.showAddressForm = false;
    this.editingAddressId = null;
    this.addressForm.reset();
  }

  saveAddress(): void {
    if (!this.addressForm.valid) {
      // Mark all controls as touched to show validation errors
      Object.keys(this.addressForm.controls).forEach(key => {
        const control = this.addressForm.get(key);
        control?.markAsTouched();
      });
      
      this.presentToast('يرجى ملء جميع الحقول المطلوبة', 'danger');
      return;
    }
    
    this.loadingCtrl.create({
      message: 'جاري حفظ العنوان...',
      spinner: 'crescent'
    }).then(loading => {
      loading.present();
      
      const formData = this.addressForm.value;
      
      // Ensure we have a name/nickname for the address
      if (!formData.address_nickname && !formData.name) {
        if (formData.type === 'custom') {
          formData.address_nickname = 'عنوان جديد';
        } else {
          formData.name = formData.type === 'shipping' ? 'عنوان الشحن' : 'عنوان الفواتير';
        }
      }
      
      // Save using the address helper, which handles all types of addresses
      this.addressHelper.saveAddress(formData)
        .pipe(
          tap(() => {
            this.presentToast(
              this.editingAddressId ? 'تم تحديث العنوان بنجاح' : 'تم إضافة العنوان بنجاح', 
              'success'
            );
            
            this.showAddressForm = false;
            this.editingAddressId = null;
            this.addressForm.reset();
            
            // Refresh the addresses list
            this.loadData();
          }),
          catchError(error => {
            console.error('Error saving address:', error);
            this.presentToast('حدث خطأ أثناء حفظ العنوان', 'danger');
            return of(null);
          }),
          finalize(() => {
            loading.dismiss();
          })
        )
        .subscribe();
    });
  }

  setDefaultAddress(address: Address): void {
    if (!address.id) {
      this.presentToast('معرف العنوان غير موجود', 'danger');
      return;
    }
    
    this.loadingCtrl.create({
      message: 'جاري تعيين العنوان الافتراضي...',
      spinner: 'crescent'
    }).then(loading => {
      loading.present();
      
      this.addressHelper.setDefaultAddress(address.id)
        .pipe(
          tap(() => {
            this.presentToast('تم تعيين العنوان الافتراضي بنجاح', 'success');
            // Refresh the addresses list
            this.loadData();
          }),
          catchError(error => {
            console.error('Error setting default address:', error);
            this.presentToast('حدث خطأ أثناء تعيين العنوان الافتراضي', 'danger');
            return of(null);
          }),
          finalize(() => {
            loading.dismiss();
          })
        )
        .subscribe();
    });
  }

  deleteAddress(address: Address): void {
    if (!address.id) {
      this.presentToast('معرف العنوان غير موجود', 'danger');
      return;
    }
    
    if (address.is_default) {
      this.presentToast('لا يمكن حذف العنوان الافتراضي', 'warning');
      return;
    }
    
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
          role: 'destructive',
          handler: () => {
            this.loadingCtrl.create({
              message: 'جاري حذف العنوان...',
              spinner: 'crescent'
            }).then(loading => {
              loading.present();
              
              this.addressHelper.deleteAddress(address.id)
                .pipe(
                  tap(() => {
                    this.presentToast('تم حذف العنوان بنجاح', 'success');
                    // Refresh the addresses list
                    this.loadData();
                  }),
                  catchError(error => {
                    console.error('Error deleting address:', error);
                    this.presentToast('حدث خطأ أثناء حذف العنوان', 'danger');
                    return of(null);
                  }),
                  finalize(() => {
                    loading.dismiss();
                  })
                )
                .subscribe();
            });
          }
        }
      ]
    }).then(alert => alert.present());
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
      cssClass: 'toast-custom'
    });
    toast.present();
  }

  isFieldInvalid(field: string): boolean {
    const control = this.addressForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}