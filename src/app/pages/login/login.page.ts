import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';
import { JwtAuthService } from '../../services/jwt-auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  emailLoginForm: FormGroup;
  mobileLoginForm: FormGroup;
  loginError: string = '';
  passwordVisible: boolean = false;
  loginType: string = 'email'; // Default to email login

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private otpService: OtpService,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.initForms();
  }

  // Initialize login forms
  initForms() {
    // Email login form
    this.emailLoginForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });

    // Mobile login form
    this.mobileLoginForm = this.formBuilder.group({
      mobile: ['', [
        Validators.required, 
        Validators.pattern('^(05)[0-9]{8}$') // Saudi mobile number format validation
      ]]
    });
  }

  // Handle login type change
  onLoginTypeChange() {
    this.loginError = ''; // Clear any previous errors
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.passwordVisible = !this.passwordVisible;
  }

  // Handle login with email/username
  async login() {
    if (this.emailLoginForm.invalid) {
      return;
    }

    const { username, password } = this.emailLoginForm.value;
    
    const loading = await this.loadingController.create({
      message: 'جاري تسجيل الدخول...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    // Only use JWT login
    this.jwtAuthService.login(username, password).subscribe({
      next: (user) => {
        loading.dismiss();
        this.router.navigateByUrl('/home');
      },
      error: (error) => {
        console.error('JWT login failed', error);
        loading.dismiss();
        
        // Show appropriate error messages based on error type
        if (error.status === 504 || error.status === 502 || error.status === 0) {
          this.loginError = 'لا يمكن الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';
        } else if (error.status === 401 || error.status === 403) {
          this.loginError = 'خطأ في تسجيل الدخول. يرجى التحقق من بيانات الاعتماد الخاصة بك.';
        } else {
          this.loginError = 'حدث خطأ أثناء تسجيل الدخول. الرجاء المحاولة مرة أخرى.';
        }
      }
    });
  }
  
  // Handle login with mobile number
  async loginWithMobile() {
    if (this.mobileLoginForm.invalid) {
      return;
    }

    const { mobile } = this.mobileLoginForm.value;
    
    // Navigate to OTP page and pass the mobile number
    this.router.navigate(['/otp'], { queryParams: { phoneNumber: mobile } });
  }

  // Go to the registration page
  goToRegister() {
    this.router.navigateByUrl('/register');
  }

  // Go to the forgot password page
  goToForgotPassword() {
    this.router.navigateByUrl('/forgot-password');
  }

  // Show welcome for guest login
  async guestLogin() {
    const alert = await this.alertController.create({
      header: 'تسجيل الدخول كضيف',
      message: 'سيتم منحك وصولاً محدوداً. هل تريد المتابعة؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'متابعة',
          handler: () => {
            this.router.navigateByUrl('/home');
          }
        }
      ]
    });

    await alert.present();
  }
}