import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NavController, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/user.interface';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
})
export class EditProfilePage implements OnInit {
  profileForm: FormGroup;
  user: User | null = null;
  isLoading = false;
  formSubmitted = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {
    this.profileForm = this.formBuilder.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      // Billing address fields
      billing_address_1: ['', Validators.required],
      billing_address_2: [''],
      billing_city: ['', Validators.required],
      billing_state: ['', Validators.required],
      billing_postcode: ['', Validators.required],
      billing_country: ['SA', Validators.required],
    });
  }

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    this.isLoading = true;
    this.authService.user.subscribe(user => {
      this.user = user;
      if (!user) {
        this.navCtrl.navigateRoot('/login');
        return;
      }
      
      // Populate form with user data
      this.profileForm.patchValue({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.billing?.phone || '',
        billing_address_1: user.billing?.address_1 || '',
        billing_address_2: user.billing?.address_2 || '',
        billing_city: user.billing?.city || '',
        billing_state: user.billing?.state || '',
        billing_postcode: user.billing?.postcode || '',
        billing_country: user.billing?.country || 'SA',
      });
      
      this.isLoading = false;
    });
  }

  async saveProfile() {
    this.formSubmitted = true;
    
    if (!this.profileForm.valid) {
      return;
    }
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري حفظ التغييرات...',
      cssClass: 'custom-loading'
    });
    await loading.present();
    
    const formData = this.profileForm.value;
    
    // Prepare the user update object with the form data
    const userData: Partial<User> = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      billing: {
        first_name: formData.first_name,
        last_name: formData.last_name,
        company: '',
        address_1: formData.billing_address_1,
        address_2: formData.billing_address_2,
        city: formData.billing_city,
        state: formData.billing_state,
        postcode: formData.billing_postcode,
        country: formData.billing_country,
        email: formData.email,
        phone: formData.phone
      },
      shipping: {
        first_name: formData.first_name,
        last_name: formData.last_name,
        company: '',
        address_1: formData.billing_address_1,
        address_2: formData.billing_address_2,
        city: formData.billing_city,
        state: formData.billing_state,
        postcode: formData.billing_postcode,
        country: formData.billing_country
      }
    };
    
    this.authService.updateUserProfile(userData).subscribe({
      next: (updatedUser) => {
        loading.dismiss();
        this.presentToast('تم تحديث الملف الشخصي بنجاح');
        this.navCtrl.navigateBack('/profile');
      },
      error: (error) => {
        loading.dismiss();
        this.presentErrorAlert('خطأ في تحديث الملف الشخصي', error.message);
      }
    });
  }

  async presentToast(message: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      cssClass: 'success-toast'
    });
    await toast.present();
  }

  async presentErrorAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header: header,
      message: message,
      buttons: ['حسناً']
    });
    await alert.present();
  }

  get errorControl() {
    return this.profileForm.controls;
  }

  hasError(controlName: string, errorName: string): boolean {
    return this.formSubmitted && 
           this.profileForm.get(controlName)?.hasError(errorName) || false;
  }

  goBack() {
    this.navCtrl.back();
  }
}