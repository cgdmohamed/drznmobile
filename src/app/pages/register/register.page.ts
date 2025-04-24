import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';
import { JwtAuthService } from '../../services/jwt-auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
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
    
    // Try JWT registration first
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
        console.log('JWT registration failed, trying legacy registration...', error);
        
        // Fallback to legacy registration if JWT fails
        const legacyUserData = {
          first_name: firstName,
          last_name: lastName,
          email: email,
          username: email,
          password: password,
          phone: phone
        };
        
        this.authService.register(legacyUserData).subscribe({
          next: async (response) => {
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
          error: (err) => {
            loading.dismiss();
            this.registerError = 'حدث خطأ أثناء التسجيل. الرجاء المحاولة مرة أخرى.';
            console.error('Registration error', err);
          }
        });
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
}