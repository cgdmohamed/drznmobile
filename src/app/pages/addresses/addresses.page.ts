import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { AddressService, CustomAddress } from 'src/app/services/address.service';
import { JwtAuthService } from 'src/app/services/jwt-auth.service';
import { User } from 'src/app/interfaces/user.interface';
import { Address, AddressResponse } from 'src/app/interfaces/address.interface';
import { Subscription, forkJoin, Observable } from 'rxjs';
import { AddressHelper } from 'src/app/helpers/address-helper';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.page.html',
  styleUrls: ['./addresses.page.scss'],
})
export class AddressesPage implements OnInit, OnDestroy {
  // Transformed array of addresses from the billing and shipping objects
  addresses: Address[] = [];
  user: User | null = null;
  isLoading = true;
  showAddressForm = false;
  currentAddressType: 'shipping' | 'billing' = 'shipping';
  editingAddressType: 'shipping' | 'billing' | null = null;
  addressForm: FormGroup;
  private addressesSubscription: Subscription;
  private userSubscription: Subscription;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private addressService: AddressService,
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
      phone: ['']
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
      
      // For debugging - log user's billing and shipping from their profile
      if (user && user.billing) {
        console.log('User has billing in profile:', user.billing);
      }
      if (user && user.shipping) {
        console.log('User has shipping in profile:', user.shipping);
      }
    });
    
    // Load addresses
    console.log('Requesting addresses from address service');
    this.addressesSubscription = this.addressService.getAddresses().subscribe((addressResponse: AddressResponse) => {
      console.log('Received address response:', addressResponse);
      
      if (addressResponse) {
        // Transform the address response into an array of addresses with type
        this.addresses = [];
        
        // Add billing address if it exists and has required fields
        if (addressResponse.billing && addressResponse.billing.first_name) {
          console.log('Adding billing address to list', addressResponse.billing);
          this.addresses.push({
            ...addressResponse.billing,
            type: 'billing',
            is_default: true // Billing address is always default
          });
        } else {
          console.log('No valid billing address found or missing first_name');
        }
        
        // Add shipping address if it exists and has required fields
        if (addressResponse.shipping && addressResponse.shipping.first_name) {
          console.log('Adding shipping address to list', addressResponse.shipping);
          this.addresses.push({
            ...addressResponse.shipping,
            type: 'shipping',
            is_default: true // Shipping address is always default
          });
        } else {
          console.log('No valid shipping address found or missing first_name');
        }
      }
      
      console.log('Final addresses array:', this.addresses);
      this.isLoading = false;
    }, error => {
      console.error('Error loading addresses:', error);
      this.isLoading = false;
      this.presentToast('فشل في تحميل العناوين', 'danger');
      
      // Fallback to user data directly
      if (this.user) {
        console.log('Attempting fallback to user profile data for addresses');
        this.addresses = [];
        
        if (this.user.billing && this.user.billing.first_name) {
          this.addresses.push({
            ...this.user.billing,
            type: 'billing',
            is_default: true
          });
        }
        
        if (this.user.shipping && this.user.shipping.first_name) {
          this.addresses.push({
            ...this.user.shipping,
            type: 'shipping',
            is_default: true
          });
        }
        
        console.log('Fallback addresses:', this.addresses);
      }
    });
  }

  openAddressForm(type: 'shipping' | 'billing') {
    this.currentAddressType = type;
    this.editingAddressType = null;
    this.addressForm.reset();
    
    // Set default values
    this.addressForm.patchValue({
      name: type === 'shipping' ? 'عنوان الشحن' : 'عنوان الفواتير',
      country: 'SA',
      first_name: this.user?.first_name || '',
      last_name: this.user?.last_name || '',
      email: type === 'billing' ? this.user?.email : '',
      phone: type === 'billing' ? this.user?.billing?.phone : ''
    });
    
    this.showAddressForm = true;
  }

  editAddress(address: Address) {
    if (!address.type) {
      this.presentToast('نوع العنوان غير محدد', 'danger');
      return;
    }
    
    this.currentAddressType = address.type;
    this.editingAddressType = address.type;
    this.addressForm.patchValue(address);
    this.showAddressForm = true;
  }

  cancelAddressForm() {
    this.showAddressForm = false;
    this.editingAddressType = null;
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
      
      if (this.editingAddressType) {
        // Update existing address
        saveOperation = this.addressService.updateAddress(this.editingAddressType, formData);
      } else {
        // Add new address
        const newAddress: Address = {
          ...formData,
          type: this.currentAddressType,
          is_default: true // New addresses are set as default
        };
        
        saveOperation = this.addressService.addAddress(newAddress);
      }
      
      saveOperation.subscribe(
        () => {
          this.presentToast(
            this.editingAddressType ? 'تم تحديث العنوان بنجاح' : 'تم إضافة العنوان بنجاح', 
            'success'
          );
          
          this.showAddressForm = false;
          this.editingAddressType = null;
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

  setDefaultAddress(address: Address) {
    if (!address.type) {
      this.presentToast('نوع العنوان غير محدد', 'danger');
      return;
    }
    
    this.loadingCtrl.create({
      message: 'جاري تعيين العنوان الافتراضي...',
      spinner: 'crescent'
    }).then(loading => {
      loading.present();
      
      this.addressService.setDefaultAddress(address.type).subscribe(
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

  deleteAddress(address: Address) {
    if (!address.type) {
      this.presentToast('نوع العنوان غير محدد', 'danger');
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
              
              this.addressService.deleteAddress(address.type).subscribe(
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
}