import { Component, OnInit, ElementRef, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NavController, LoadingController, ToastController, AlertController, ActionSheetController, Platform, IonicModule } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { User } from '../../interfaces/user.interface';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class EditProfilePage implements OnInit {
  @ViewChild('fileInput', { static: false }) fileInput: ElementRef;
  
  profileForm: FormGroup;
  user: User | null = null;
  isLoading = false;
  formSubmitted = false;
  profileImageUrl: SafeUrl | null = null;
  selectedImageFile: File | null = null;
  isMobile: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private storage: Storage,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private platform: Platform,
    private sanitizer: DomSanitizer
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
    this.isMobile = this.platform.is('ios') || this.platform.is('android');
  }

  loadUserProfile() {
    this.isLoading = true;
    
    // Try to get user from JWT auth service first
    this.jwtAuthService.currentUser$.subscribe(jwtUser => {
      if (jwtUser) {
        console.log('Using JWT auth user profile');
        this.user = jwtUser;
        this.updateFormWithUserData(jwtUser);
        this.isLoading = false;
        return;
      }
      
      // Fall back to legacy auth service if JWT auth doesn't have a user
      this.authService.user.subscribe(legacyUser => {
        if (legacyUser) {
          console.log('Using legacy auth user profile');
          this.user = legacyUser;
          this.updateFormWithUserData(legacyUser);
          this.isLoading = false;
          return;
        }
        
        // If no user is found in either service, check storage directly
        this.checkStoredCredentials();
      });
    });
  }
  
  private updateFormWithUserData(user: User) {
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
  }
  
  private async checkStoredCredentials() {
    try {
      const user = await this.jwtAuthService.getUser();
      if (user) {
        console.log('Found user in storage, restoring session');
        // Update the user subject
        this.jwtAuthService.setCurrentUser(user);
        this.user = user;
        this.updateFormWithUserData(user);
        this.isLoading = false;
      } else {
        console.log('No user found in storage, redirecting to login');
        this.isLoading = false;
        this.navCtrl.navigateRoot('/login');
      }
    } catch (error) {
      console.error('Error checking stored credentials', error);
      this.isLoading = false;
      this.navCtrl.navigateRoot('/login');
    }
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
    
    try {
      // First, upload the profile image if one was selected
      let profileImageUrl = null;
      if (this.selectedImageFile) {
        // In production, you'd call a real API here
        profileImageUrl = await this.uploadProfileImage();
      }
      
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
        },
        // Add avatar URL if we have one
        ...(profileImageUrl && { avatar_url: profileImageUrl })
      };
      
      // Try to use JWT auth service first if we have a user there
      if (this.jwtAuthService.isAuthenticated) {
        console.log('Updating profile with JWT auth service');
        // For JWT auth we would call WooCommerce REST API directly
        // For now, just update the user in JWT auth service
        const currentUser = { ...this.jwtAuthService.currentUserValue };
        const updatedUser = { ...currentUser, ...userData };
        
        // Use the JWT service method to update the user which will handle storage for us
        this.jwtAuthService.updateUserData(updatedUser);
        
        loading.dismiss();
        this.presentToast('تم تحديث الملف الشخصي بنجاح');
        this.navCtrl.navigateBack('/profile');
      } else {
        // Fall back to legacy auth service
        console.log('Updating profile with legacy auth service');
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
    } catch (error) {
      console.error('Error updating profile:', error);
      loading.dismiss();
      this.presentErrorAlert('خطأ في تحميل الصورة', 'حدث خطأ أثناء رفع صورة الملف الشخصي، يرجى المحاولة مرة أخرى.');
    }
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

  /**
   * Open the image selection dialog
   */
  async selectImage() {
    if (this.isMobile) {
      // On mobile, show an action sheet with camera and gallery options
      const actionSheet = await this.actionSheetCtrl.create({
        header: 'اختر مصدر الصورة',
        cssClass: 'image-selection-action-sheet',
        buttons: [
          {
            text: 'التقاط صورة',
            icon: 'camera',
            handler: () => {
              // We'll use a file input for demo purposes
              this.openFileInput();
            }
          },
          {
            text: 'اختيار من المعرض',
            icon: 'image',
            handler: () => {
              this.openFileInput();
            }
          },
          {
            text: 'إلغاء',
            icon: 'close',
            role: 'cancel'
          }
        ]
      });
      await actionSheet.present();
    } else {
      // On desktop, just open the file picker
      this.openFileInput();
    }
  }

  /**
   * Open the hidden file input
   */
  openFileInput() {
    // Create a file input element programmatically
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.handleSelectedFile(file);
      }
    };
    
    // Trigger click to open file picker
    fileInput.click();
  }

  /**
   * Handle selected image file
   */
  handleSelectedFile(file: File) {
    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png|gif)/)) {
      this.presentErrorAlert('خطأ في تحميل الصورة', 'يرجى اختيار صورة بتنسيق صالح (JPEG, PNG, GIF)');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.presentErrorAlert('خطأ في تحميل الصورة', 'حجم الصورة كبير جداً، يجب أن يكون أقل من 5 ميجابايت');
      return;
    }
    
    // Store the selected file
    this.selectedImageFile = file;
    
    // Create a preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        this.profileImageUrl = this.sanitizer.bypassSecurityTrustUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }

  /**
   * Upload profile image to server
   * This method would be called when saving the profile
   */
  async uploadProfileImage(): Promise<string | null> {
    if (!this.selectedImageFile) {
      return null;
    }
    
    // Create a FormData object to send the image
    const formData = new FormData();
    formData.append('image', this.selectedImageFile);
    
    // In a real implementation, we would use the AuthService to upload the image
    // For now, we'll just return a success message
    
    // Simulate API success response with a placeholder URL
    return 'https://via.placeholder.com/150';
    
    // Example of real implementation with API call:
    /*
    try {
      const response = await this.authService.uploadProfileImage(formData).toPromise();
      return response.imageUrl;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      return null;
    }
    */
  }
}