import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController, AlertController, NavController } from '@ionic/angular';
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
    private addressHelper: AddressHelper,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private navCtrl: NavController
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
    // Just load data - the address API calls will return errors if not authenticated
    console.log('AddressesPage: Initializing');
    this.loadData();
  }
  
  // Present login alert
  async presentLoginAlert() {
    const alert = await this.alertCtrl.create({
      header: 'تنبيه',
      message: 'يجب تسجيل الدخول أولاً للوصول إلى العناوين',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          handler: () => {
            this.loadingCtrl.dismiss().catch(() => {});
            history.back();
          }
        },
        {
          text: 'تسجيل الدخول',
          handler: () => {
            this.loadingCtrl.dismiss().catch(() => {});
            this.navCtrl.navigateForward('/login');
          }
        }
      ]
    });
    await alert.present();
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
    
    // Load addresses using the address helper
    console.log('Requesting addresses from address helper');
    this.addressesSubscription = this.addressHelper.getAllAddresses().subscribe((allAddresses) => {
      console.log('Received all addresses from helper:', allAddresses);
      
      // Convert to Address[] array for display
      this.addresses = allAddresses as Address[];
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
            is_default: true,
            id: 'billing'
          });
        }
        
        if (this.user.shipping && this.user.shipping.first_name) {
          this.addresses.push({
            ...this.user.shipping,
            type: 'shipping',
            is_default: true,
            id: 'shipping'
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
      
      // Create address object with proper ID and type
      const address: Address = {
        ...formData,
        type: this.currentAddressType,
        is_default: true
      };
      
      // If editing, set the id
      if (this.editingAddressType) {
        address.id = this.editingAddressType;
      }
      
      // Use the address helper to save the address
      this.addressHelper.saveAddress(address).subscribe(
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

  deleteAddress(address: Address) {
    if (!address.id) {
      this.presentToast('معرف العنوان غير محدد', 'danger');
      return;
    }
    
    // Don't allow deletion of primary addresses
    if (address.id === 'billing' || address.id === 'shipping') {
      this.presentToast('لا يمكن حذف العناوين الأساسية', 'warning');
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
}