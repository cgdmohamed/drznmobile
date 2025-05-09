import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RegisterPage implements OnInit {
  registerForm: FormGroup;
  mobileForm: FormGroup;
  registerError: string = '';
  passwordVisible: boolean = false;
  confirmPasswordVisible: boolean = false;
  registrationType: string = 'email'; // Default to email registration

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private otpService: OtpService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.initForms();
  }

  // Initialize registration forms
  initForms() {
    // Email registration form
    this.registerForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]+$'), Validators.minLength(9)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, { 
      validators: this.passwordMatchValidator 
    });

    // Mobile registration form
    this.mobileForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]+$'), Validators.minLength(9)]],
      acceptTerms: [false, [Validators.requiredTrue]]
    });
  }

  // Handle registration type change
  registrationTypeChanged() {
    // Reset error message when switching between registration types
    this.registerError = '';
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    if (password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  // Handle user registration with email
  async register() {
    if (this.registerForm.invalid) {
      return;
    }

    const { firstName, lastName, email, phone, password } = this.registerForm.value;
    
    const loading = await this.loadingController.create({
      message: 'جاري إنشاء الحساب...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    // Prepare data for JWT registration
    const jwtUserData = {
      email: email,
      username: email, // Use email as username
      password: password,
      first_name: firstName,
      last_name: lastName
    };
    
    // Only use JWT registration
    this.jwtAuthService.register(jwtUserData).subscribe({
      next: async (user) => {
        loading.dismiss();
        const toast = await this.toastController.create({
          message: 'تم إنشاء الحساب بنجاح!',
          duration: 2000,
          position: 'bottom',
          color: 'success'
        });
        await toast.present();
        this.router.navigateByUrl('/home');
      },
      error: (error) => {
        console.error('JWT registration failed', error);
        loading.dismiss();
        
        // Handle different error cases with appropriate messages
        if (error.status === 504 || error.status === 502 || error.status === 0) {
          // Connection errors
          this.registerError = 'لا يمكن الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';
        } else if (error.status === 409 || 
                 (error.error && error.error.code === 'registration-error-email-exists') ||
                 (error.error && error.error.data && error.error.data.message && 
                  error.error.data.message.includes('User already exists'))) {
          // Email already exists - check for different formats of error messages
          this.registerError = 'البريد الإلكتروني مستخدم بالفعل. يرجى استخدام بريد إلكتروني مختلف.';
        } else if (error.error && error.error.code === 'registration-error-username-exists') {
          // Username already exists
          this.registerError = 'اسم المستخدم مستخدم بالفعل. يرجى استخدام اسم مستخدم مختلف.';
        } else if (error.status === 400) {
          // Bad request - typically validation errors
          if (error.error?.data?.message) {
            // Handle specific error messages from JWT plugin
            const errorMessage = error.error.data.message;
            if (errorMessage.includes('User already exists')) {
              this.registerError = 'البريد الإلكتروني مستخدم بالفعل. يرجى استخدام بريد إلكتروني مختلف.';
            } else if (errorMessage.includes('password')) {
              this.registerError = 'كلمة المرور غير صالحة. يرجى استخدام كلمة مرور أقوى.';
            } else if (errorMessage.includes('email')) {
              this.registerError = 'البريد الإلكتروني غير صالح. يرجى التحقق من صياغة البريد الإلكتروني.';
            } else {
              // Show the exact error message from the server if it's available
              this.registerError = errorMessage;
            }
          } else if (error.error && error.error.message) {
            // Simple error message
            const errorMessage = error.error.message;
            if (errorMessage.includes('password')) {
              this.registerError = 'كلمة المرور غير صالحة. يرجى استخدام كلمة مرور أقوى.';
            } else if (errorMessage.includes('email')) {
              this.registerError = 'البريد الإلكتروني غير صالح. يرجى التحقق من صياغة البريد الإلكتروني.';
            } else {
              this.registerError = errorMessage;
            }
          } else {
            this.registerError = 'بيانات التسجيل غير صالحة. يرجى التحقق من المعلومات المدخلة.';
          }
        } else if (error.message) {
          // If we have a clear error message, display it
          this.registerError = error.message;
        } else {
          // Generic fallback error
          this.registerError = 'حدث خطأ أثناء التسجيل. الرجاء المحاولة مرة أخرى.';
        }
        
        // Display the error message as a toast for better visibility
        this.presentErrorToast(this.registerError);
      }
    });
  }

  // Handle user registration with mobile number
  async registerWithMobile() {
    if (this.mobileForm.invalid) {
      return;
    }

    const { firstName, lastName, phone } = this.mobileForm.value;
    
    const loading = await this.loadingController.create({
      message: 'جاري إرسال رمز التحقق...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    // Format phone number for OTP service
    const formattedPhone = `966${phone}`; // Add Saudi country code
    
    this.otpService.sendOtp(formattedPhone).subscribe(
      async response => {
        loading.dismiss();
        
        // Store user data in local storage for retrieval after OTP verification
        const userData = {
          first_name: firstName,
          last_name: lastName,
          phone: formattedPhone
        };
        
        localStorage.setItem('pendingRegistration', JSON.stringify(userData));
        
        // Navigate to OTP verification page
        this.router.navigate(['/otp'], { 
          queryParams: { 
            phoneNumber: formattedPhone,
            isRegistration: true
          } 
        });
      },
      error => {
        loading.dismiss();
        this.registerError = 'حدث خطأ أثناء إرسال رمز التحقق. الرجاء المحاولة مرة أخرى.';
        console.error('OTP sending error', error);
      }
    );
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  // Toggle confirm password visibility
  toggleConfirmPasswordVisibility() {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  // Navigate to login page
  goToLogin() {
    this.router.navigateByUrl('/login');
  }
  
  // Present error toast
  async presentErrorToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: 'danger',
      buttons: [
        {
          text: 'إغلاق',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}