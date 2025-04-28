import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { AddressService, CustomAddress } from 'src/app/services/address.service';
import { JwtAuthService } from 'src/app/services/jwt-auth.service';
import { User } from 'src/app/interfaces/user.interface';
import { Address, AddressResponse } from 'src/app/interfaces/address.interface';
import { Subscription, Observable } from 'rxjs';
import { AddressHelper } from 'src/app/helpers/address-helper';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.page.html',
  styleUrls: ['./addresses.page.scss'],
})
export class AddressesPage implements OnInit, OnDestroy {
  // Combined array of all addresses (standard and custom)
  addresses: (Address | CustomAddress)[] = [];
  standardAddresses: Address[] = []; // Billing and shipping
  customAddresses: CustomAddress[] = []; // Additional addresses
  user: User | null = null;
  isLoading = true;
  showAddressForm = false;
  isCustomAddress = false;
  currentAddressType: 'shipping' | 'billing' = 'shipping';
  editingAddressId: string | number | null = null;
  addressForm: FormGroup;
  private addressesSubscription: Subscription;
  private userSubscription: Subscription;

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
      address_nickname: [''],
      type: ['shipping']
    });
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    if (this.addressesSubscription) {
      this.addressesSubscription.unsubscribe();
    }
    
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  loadData() {
    console.log('Loading addresses page data');
    this.isLoading = true;
    
    // Load user data
    this.userSubscription = this.authService.user.subscribe(user => {
      this.user = user;
      console.log('User loaded from AuthService:', user);
    });
    
    // Load addresses using the AddressHelper
    this.addressesSubscription = this.addressHelper.getAllAddresses().subscribe(
      (allAddresses: (Address | CustomAddress)[]) => {
        console.log('Received all addresses:', allAddresses);
        
        // Store all addresses
        this.addresses = allAddresses;
        
        // Separate into standard and custom
        this.standardAddresses = allAddresses.filter(
          addr => addr.type === 'billing' || addr.type === 'shipping'
        ) as Address[];
        
        this.customAddresses = allAddresses.filter(
          addr => addr.id !== 'billing' && addr.id !== 'shipping'
        ) as CustomAddress[];
        
        console.log('Standard addresses:', this.standardAddresses);
        console.log('Custom addresses:', this.customAddresses);
        this.isLoading = false;
      }, 
      error => {
        console.error('Error loading addresses:', error);
        this.isLoading = false;
        this.presentToast('فشل في تحميل العناوين', 'danger');
        
        // Fallback to user data directly
        if (this.user) {
          console.log('Attempting fallback to user profile data for addresses');
          this.addresses = [];
          this.standardAddresses = [];
          
          if (this.user.billing && this.user.billing.first_name) {
            const billingAddress: Address = {
              ...this.user.billing,
              id: 'billing',
              type: 'billing' as 'billing',
              is_default: true
            };
            this.addresses.push(billingAddress);
            this.standardAddresses.push(billingAddress);
          }
          
          if (this.user.shipping && this.user.shipping.first_name) {
            const shippingAddress: Address = {
              ...this.user.shipping,
              id: 'shipping',
              type: 'shipping' as 'shipping',
              is_default: true
            };
            this.addresses.push(shippingAddress);
            this.standardAddresses.push(shippingAddress);
          }
          
          console.log('Fallback addresses:', this.addresses);
        }
      }
    );
  }

  openAddressForm(type: 'shipping' | 'billing' | 'custom') {
    this.currentAddressType = type === 'custom' ? 'shipping' : type;
    this.isCustomAddress = type === 'custom';
    this.editingAddressId = null;
    this.addressForm.reset();
    
    // Set default values
    this.addressForm.patchValue({
      name: this.getAddressNameByType(type),
      country: 'SA',
      first_name: this.user?.first_name || '',
      last_name: this.user?.last_name || '',
      email: (type === 'billing' || this.isCustomAddress) ? this.user?.email : '',
      phone: (type === 'billing' || this.isCustomAddress) ? this.user?.billing?.phone : '',
      type: this.isCustomAddress ? 'shipping' : type,
      address_nickname: this.isCustomAddress ? 'عنوان إضافي' : ''
    });
    
    this.showAddressForm = true;
  }

  getAddressNameByType(type: 'shipping' | 'billing' | 'custom'): string {
    switch (type) {
      case 'shipping': return 'عنوان الشحن';
      case 'billing': return 'عنوان الفواتير';
      case 'custom': return 'عنوان إضافي';
      default: return 'عنوان جديد';
    }
  }

  editAddress(address: Address | CustomAddress) {
    if (!address.type) {
      this.presentToast('نوع العنوان غير محدد', 'danger');
      return;
    }
    
    // Determine if this is a custom address
    this.isCustomAddress = address.id !== 'billing' && address.id !== 'shipping';
    this.currentAddressType = address.type as 'shipping' | 'billing';
    this.editingAddressId = address.id || null;
    
    // Patch the form with address values
    this.addressForm.patchValue(address);
    
    // Show the form
    this.showAddressForm = true;
  }

  cancelAddressForm() {
    this.showAddressForm = false;
    this.editingAddressId = null;
    this.isCustomAddress = false;
    this.addressForm.reset();
  }

  saveAddress() {
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
      let saveOperation: Observable<any>;
      
      // Prepare the address object
      const addressData: Address | CustomAddress = {
        ...formData,
        type: this.currentAddressType
      };
      
      // For custom addresses, include the address_nickname field
      if (this.isCustomAddress) {
        (addressData as CustomAddress).address_nickname = formData.address_nickname || 'عنوان إضافي';
      }
      
      // If editing, include the ID
      if (this.editingAddressId) {
        addressData.id = this.editingAddressId;
      }
      
      // Use the address helper to save
      saveOperation = this.addressHelper.saveAddress(addressData);
      
      saveOperation.subscribe(
        () => {
          this.presentToast(
            this.editingAddressId ? 'تم تحديث العنوان بنجاح' : 'تم إضافة العنوان بنجاح', 
            'success'
          );
          
          this.showAddressForm = false;
          this.editingAddressId = null;
          this.isCustomAddress = false;
          this.addressForm.reset();
          
          // Refresh the addresses list
          this.loadData();
          loading.dismiss();
        },
        error => {
          console.error('Error saving address:', error);
          this.presentToast('حدث خطأ أثناء حفظ العنوان', 'danger');
          loading.dismiss();
        }
      );
    });
  }

  setDefaultAddress(address: Address | CustomAddress) {
    if (!address.id) {
      this.presentToast('معرف العنوان غير محدد', 'danger');
      return;
    }
    
    this.loadingCtrl.create({
      message: 'جاري تعيين العنوان الافتراضي...',
      spinner: 'crescent'
    }).then(loading => {
      loading.present();
      
      this.addressHelper.setDefaultAddress(address.id).subscribe(
        () => {
          this.presentToast('تم تعيين العنوان الافتراضي بنجاح', 'success');
          // Refresh the addresses list
          this.loadData();
          loading.dismiss();
        },
        error => {
          console.error('Error setting default address:', error);
          this.presentToast('حدث خطأ أثناء تعيين العنوان الافتراضي', 'danger');
          loading.dismiss();
        }
      );
    });
  }

  deleteAddress(address: Address | CustomAddress) {
    if (!address.id) {
      this.presentToast('معرف العنوان غير محدد', 'danger');
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
              
              this.addressHelper.deleteAddress(address.id).subscribe(
                () => {
                  this.presentToast('تم حذف العنوان بنجاح', 'success');
                  // Refresh the addresses list
                  this.loadData();
                  loading.dismiss();
                },
                error => {
                  console.error('Error deleting address:', error);
                  this.presentToast('حدث خطأ أثناء حذف العنوان', 'danger');
                  loading.dismiss();
                }
              );
            });
          }
        }
      ]
    }).then(alert => alert.present());
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
      cssClass: 'toast-custom'
    });
    toast.present();
  }

  // Check if form control is invalid
  isFieldInvalid(field: string): boolean {
    const control = this.addressForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  // Filter addresses by type
  getAddressesByType(type: 'shipping' | 'billing' | 'custom'): (Address | CustomAddress)[] {
    if (type === 'custom') {
      return this.customAddresses;
    } else {
      return this.standardAddresses.filter(a => a.type === type);
    }
  }
}