import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { AddressService } from 'src/app/services/address.service';
import { User } from 'src/app/interfaces/user.interface';
import { Address } from 'src/app/interfaces/address.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.page.html',
  styleUrls: ['./addresses.page.scss'],
})
export class AddressesPage implements OnInit {
  addresses: Address[] = [];
  user: User | null = null;
  isLoading = true;
  showAddressForm = false;
  currentAddressType: 'shipping' | 'billing' = 'shipping';
  editingAddressId: string | null = null;
  addressForm: FormGroup;
  private addressesSubscription: Subscription;
  private userSubscription: Subscription;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
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
    this.isLoading = true;
    
    // Load user data
    this.userSubscription = this.authService.user.subscribe(user => {
      this.user = user;
    });
    
    // Load addresses
    this.addressesSubscription = this.addressService.addresses.subscribe(addresses => {
      this.addresses = addresses;
      this.isLoading = false;
    });
  }

  openAddressForm(type: 'shipping' | 'billing') {
    this.currentAddressType = type;
    this.editingAddressId = null;
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
    this.currentAddressType = address.type;
    this.editingAddressId = address.id;
    this.addressForm.patchValue(address);
    this.showAddressForm = true;
  }

  cancelAddressForm() {
    this.showAddressForm = false;
    this.editingAddressId = null;
    this.addressForm.reset();
  }

  async saveAddress() {
    if (!this.addressForm.valid) {
      // Mark all controls as touched to show validation errors
      Object.keys(this.addressForm.controls).forEach(key => {
        const control = this.addressForm.get(key);
        control?.markAsTouched();
      });
      
      this.presentToast('يرجى ملء جميع الحقول المطلوبة', 'danger');
      return;
    }
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري حفظ العنوان...',
      spinner: 'crescent'
    });
    await loading.present();
    
    const formData = this.addressForm.value;
    
    try {
      if (this.editingAddressId) {
        // Update existing address
        await this.addressService.updateAddress(this.editingAddressId, formData).toPromise();
        this.presentToast('تم تحديث العنوان بنجاح', 'success');
      } else {
        // Add new address
        const newAddress: Omit<Address, 'id'> = {
          ...formData,
          type: this.currentAddressType,
          default: false
        };
        await this.addressService.addAddress(newAddress).toPromise();
        this.presentToast('تم إضافة العنوان بنجاح', 'success');
      }
      
      this.showAddressForm = false;
      this.editingAddressId = null;
      this.addressForm.reset();
    } catch (error) {
      console.error('Error saving address:', error);
      this.presentToast('حدث خطأ أثناء حفظ العنوان', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  async setDefaultAddress(address: Address) {
    const loading = await this.loadingCtrl.create({
      message: 'جاري تعيين العنوان الافتراضي...',
      spinner: 'crescent'
    });
    await loading.present();
    
    try {
      await this.addressService.setDefaultAddress(address.id).toPromise();
      this.presentToast('تم تعيين العنوان الافتراضي بنجاح', 'success');
    } catch (error) {
      console.error('Error setting default address:', error);
      this.presentToast('حدث خطأ أثناء تعيين العنوان الافتراضي', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  async deleteAddress(address: Address) {
    if (address.default) {
      this.presentToast('لا يمكن حذف العنوان الافتراضي', 'warning');
      return;
    }
    
    const alert = await this.alertCtrl.create({
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
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'جاري حذف العنوان...',
              spinner: 'crescent'
            });
            await loading.present();
            
            try {
              await this.addressService.deleteAddress(address.id).toPromise();
              this.presentToast('تم حذف العنوان بنجاح', 'success');
            } catch (error) {
              console.error('Error deleting address:', error);
              this.presentToast('حدث خطأ أثناء حذف العنوان', 'danger');
            } finally {
              loading.dismiss();
            }
          }
        }
      ]
    });
    
    await alert.present();
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