import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { LoadingController, AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { OtpService } from '../../services/otp.service';
import { JwtAuthService } from '../../services/jwt-auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginPage implements OnInit {
  emailLoginForm: FormGroup;
  mobileLoginForm: FormGroup;
  loginError: string = '';
  passwordVisible: boolean = false;
  loginType: string = 'email'; // Default to email login

  returnUrl: string = '/home';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private otpService: OtpService,
    private router: Router,
    private route: ActivatedRoute,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.initForms();
    
    // Get return URL from query params or localStorage, or use default
    this.route.queryParams.subscribe(params => {
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      } else {
        // Check if we have a saved redirect URL in localStorage
        const savedRedirectUrl = localStorage.getItem('redirectUrl');
        if (savedRedirectUrl) {
          this.returnUrl = savedRedirectUrl;
          // Clear the saved URL after retrieving it
          localStorage.removeItem('redirectUrl');
        }
      }
    });
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
        console.log('Login successful, redirecting to:', this.returnUrl);
        this.router.navigateByUrl(this.returnUrl || '/home');
      },
      error: (error) => {
        console.error('JWT login failed', error);
        loading.dismiss();
        
        // Show appropriate error messages based on error type and error response
        if (error.status === 504 || error.status === 502 || error.status === 0) {
          this.loginError = 'لا يمكن الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';
        } else if (error.status === 400) {
          // Check for specific error message from backend
          if (error.error?.data?.message === 'Wrong user credentials.') {
            this.loginError = 'اسم المستخدم أو كلمة المرور غير صحيحة، الرجاء المحاولة مرة أخرى.';
          } else if (error.error?.message) {
            this.loginError = error.error.message;
          } else {
            this.loginError = 'بيانات تسجيل الدخول غير صالحة، الرجاء التحقق والمحاولة مرة أخرى.';
          }
        } else if (error.status === 401 || error.status === 403) {
          this.loginError = 'خطأ في تسجيل الدخول. يرجى التحقق من بيانات الاعتماد الخاصة بك.';
        } else if (error.message) {
          // If we have a specific error message from our service
          this.loginError = error.message;
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


}