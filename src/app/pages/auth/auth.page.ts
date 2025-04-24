import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { RegisterService } from '../../services/register.service';
import { finalize } from 'rxjs/operators';

/**
 * Auth mode types
 */
type AuthMode = 'login' | 'register' | 'forgot-password' | 'otp' | 'verify-otp' | 'reset-password';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
})
export class AuthPage implements OnInit {
  authMode: AuthMode = 'login';
  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotPasswordForm: FormGroup;
  otpForm: FormGroup;
  resetPasswordForm: FormGroup;
  isLoading = false;
  verificationId: string | null = null;
  mobileNumber: string | null = null;
  passwordVisible = false;
  confirmPasswordVisible = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private jwtAuthService: JwtAuthService,
    private registerService: RegisterService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    // Initialize forms
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.registerForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      mobile: ['', [Validators.required, Validators.pattern(/^\+[0-9]{10,15}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, { validator: this.checkPasswords });

    this.forgotPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.otpForm = this.formBuilder.group({
      mobile: ['', [Validators.required, Validators.pattern(/^\+[0-9]{10,15}$/)]],
    });

    this.resetPasswordForm = this.formBuilder.group({
      otp: ['', [Validators.required, Validators.pattern(/^[0-9]{4,6}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.checkPasswords });
  }

  ngOnInit() {
    // Check if already authenticated
    this.jwtAuthService.isAuthenticated.subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.router.navigate(['/tabs/home']);
      }
    });
  }

  /**
   * Switch auth mode (login, register, forgot password, etc)
   * @param mode Auth mode to switch to
   */
  switchMode(mode: AuthMode) {
    this.authMode = mode;
  }

  /**
   * Check that password and confirm password match
   * @param group FormGroup containing password and confirmPassword
   */
  checkPasswords(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { notMatching: true };
  }

  /**
   * Handle login form submission
   */
  async onLogin() {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Logging in...',
      spinner: 'crescent'
    });
    await loading.present();

    const credentials = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    this.jwtAuthService.login(credentials)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isLoading = false;
      }))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.presentToast('Login successful!');
            this.router.navigate(['/tabs/home']);
          } else {
            this.presentToast(response.error || 'Login failed. Please check your credentials.');
          }
        },
        error: (error) => {
          this.presentToast(error.message || 'Login failed. Please check your credentials.');
        }
      });
  }

  /**
   * Handle registration form submission
   */
  async onRegister() {
    if (this.registerForm.invalid) {
      return;
    }

    // First, verify mobile number with OTP
    this.mobileNumber = this.registerForm.value.mobile;
    this.sendOtp(this.mobileNumber);
  }

  /**
   * Send OTP to mobile number
   * @param mobile Mobile number to send OTP to
   */
  async sendOtp(mobile: string) {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Sending OTP...',
      spinner: 'crescent'
    });
    await loading.present();

    this.registerService.sendOtp(mobile)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isLoading = false;
      }))
      .subscribe({
        next: (response) => {
          if (response.success && response.data?.verification_id) {
            this.verificationId = response.data.verification_id;
            this.switchMode('verify-otp');
            this.presentToast('OTP sent to your mobile number');
          } else {
            this.presentToast(response.error || 'Failed to send OTP. Please try again.');
          }
        },
        error: (error) => {
          this.presentToast(error.message || 'Failed to send OTP. Please try again.');
        }
      });
  }

  /**
   * Verify OTP and complete registration
   */
  async verifyOtpAndRegister() {
    if (this.resetPasswordForm.invalid || !this.mobileNumber || !this.verificationId) {
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Verifying OTP...',
      spinner: 'crescent'
    });
    await loading.present();

    this.registerService.verifyOtp(
      this.mobileNumber,
      this.resetPasswordForm.value.otp,
      this.verificationId
    ).pipe(finalize(() => loading.dismiss()))
      .subscribe({
        next: (response) => {
          if (response.success) {
            // OTP verified, now register user
            this.completeRegistration();
          } else {
            this.isLoading = false;
            this.presentToast(response.error || 'OTP verification failed. Please try again.');
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.presentToast(error.message || 'OTP verification failed. Please try again.');
        }
      });
  }

  /**
   * Complete registration after OTP verification
   */
  private async completeRegistration() {
    const userData = {
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password,
      meta_data: [
        { key: 'mobile', value: this.mobileNumber }
      ]
    };

    const loading = await this.loadingController.create({
      message: 'Creating your account...',
      spinner: 'crescent'
    });
    await loading.present();

    this.registerService.register(userData)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isLoading = false;
      }))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.presentToast('Account created successfully! Please login.');
            this.loginForm.patchValue({
              email: this.registerForm.value.email,
              password: ''
            });
            this.switchMode('login');
          } else {
            this.presentToast(response.error || 'Registration failed. Please try again.');
          }
        },
        error: (error) => {
          this.presentToast(error.message || 'Registration failed. Please try again.');
        }
      });
  }

  /**
   * Handle forgot password form submission
   */
  async onForgotPassword() {
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Sending reset link...',
      spinner: 'crescent'
    });
    await loading.present();

    this.registerService.requestPasswordReset(this.forgotPasswordForm.value.email)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isLoading = false;
      }))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.presentToast('Password reset instructions have been sent to your email.');
            this.switchMode('login');
          } else {
            this.presentToast(response.error || 'Failed to request password reset. Please try again.');
          }
        },
        error: (error) => {
          this.presentToast(error.message || 'Failed to request password reset. Please try again.');
        }
      });
  }

  /**
   * Toggle password visibility
   * @param field Which password field to toggle
   */
  togglePasswordVisibility(field: 'password' | 'confirmPassword') {
    if (field === 'password') {
      this.passwordVisible = !this.passwordVisible;
    } else {
      this.confirmPasswordVisible = !this.confirmPasswordVisible;
    }
  }

  /**
   * Helper method to present toast messages
   * @param message Message to display
   */
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: 'dark',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}