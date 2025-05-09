import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { LoadingController, AlertController, ToastController, NavController } from '@ionic/angular';
import { OtpService } from '../../services/otp.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-phone-register',
  templateUrl: './phone-register.page.html',
  styleUrls: ['./phone-register.page.scss'],
})
export class PhoneRegisterPage implements OnInit, OnDestroy {
  phoneForm: FormGroup;
  otpForm: FormGroup;
  userDetailsForm: FormGroup;
  step: 'phone' | 'verify' | 'details' = 'phone';
  phoneNumber: string = '';
  verificationCode: string = '';
  isSubmitting: boolean = false;
  countdown: number = 0;
  timeLeft: string = '';
  countdownInterval: any;
  resendDisabled: boolean = true;
  errorMessage: string = '';
  
  // OTP input fields (4-digit)
  otpDigits: string[] = ['', '', '', ''];
  returnUrl: string = '/';
  
  private otpSendSubscription: Subscription;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private otpService: OtpService,
    private jwtAuthService: JwtAuthService,
    private authService: AuthService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private navController: NavController
  ) { }

  ngOnInit() {
    // Initialize forms
    this.initForms();
    
    // Get return URL from route parameters or default to 'home'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
    
    // Check if the user is already authenticated
    if (this.jwtAuthService.isAuthenticated || this.authService.isLoggedIn) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  ngOnDestroy() {
    // Clear the countdown interval if it exists
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    // Unsubscribe from any active subscriptions
    if (this.otpSendSubscription) {
      this.otpSendSubscription.unsubscribe();
    }
  }

  // Initialize all forms
  initForms() {
    // Phone form
    this.phoneForm = this.formBuilder.group({
      phone: ['', [
        Validators.required,
        Validators.pattern(/^(5\d{8})$/) // Without the leading 0
      ]]
    });
    
    // OTP verification form
    this.otpForm = this.formBuilder.group({
      otp: ['', [
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(4),
        Validators.pattern(/^\d{4}$/)
      ]]
    });
    
    // User details form
    this.userDetailsForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(6)
      ]],
      confirmPassword: ['', Validators.required]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  // Send OTP to the provided phone number
  async sendOTP() {
    if (this.phoneForm.invalid) {
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    // Get phone number from form
    const phoneValue = this.phoneForm.get('phone').value;
    this.phoneNumber = this.formatPhoneNumber(phoneValue);
    
    const loading = await this.loadingController.create({
      message: 'جاري إرسال رمز التحقق...',
      spinner: 'crescent'
    });
    await loading.present();
    
    this.otpSendSubscription = this.otpService.sendOtp(phoneValue)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isSubmitting = false;
      }))
      .subscribe({
        next: (response) => {
          console.log('OTP sent successfully:', response);
          
          // Reset OTP digits
          this.otpDigits = ['', '', '', ''];
          
          // Move to verification step
          this.step = 'verify';
          
          // Start countdown for resend (2 minutes)
          this.startCountdown(120);
          
          // Present success toast
          this.presentToast('تم إرسال رمز التحقق بنجاح', 'success');
        },
        error: (error) => {
          console.error('Error sending OTP:', error);
          
          this.errorMessage = error.message || 'فشل في إرسال رمز التحقق. يرجى التحقق من رقم الهاتف والمحاولة مرة أخرى.';
          this.presentToast(this.errorMessage, 'danger');
        }
      });
  }
  
  // Verify the OTP entered by the user
  async verifyOTP() {
    // Construct the full OTP from the digits
    const fullOtp = this.otpDigits.join('');
    
    if (fullOtp.length !== 4 || !/^\d{4}$/.test(fullOtp)) {
      this.errorMessage = 'يرجى إدخال رمز التحقق المكون من 4 أرقام بشكل صحيح.';
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    const loading = await this.loadingController.create({
      message: 'جاري التحقق من الرمز...',
      spinner: 'crescent'
    });
    await loading.present();
    
    try {
      // Verify OTP using the OTP service
      const valid = await this.otpService.verifyOtp(fullOtp);
      
      loading.dismiss();
      this.isSubmitting = false;
      
      if (valid) {
        this.presentToast('تم التحقق من الرمز بنجاح', 'success');
        
        // Move to user details step
        this.step = 'details';
        
        // Clear any active timers
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
        }
      } else {
        this.errorMessage = 'رمز التحقق غير صحيح أو منتهي الصلاحية.';
        
        // Reset OTP fields
        this.otpDigits = ['', '', '', ''];
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      loading.dismiss();
      this.isSubmitting = false;
      
      this.errorMessage = error.message || 'حدث خطأ أثناء التحقق من الرمز. يرجى المحاولة مرة أخرى.';
    }
  }
  
  // Complete registration with user details
  async completeRegistration() {
    if (this.userDetailsForm.invalid) {
      // Mark all fields as touched to trigger validation error messages
      Object.keys(this.userDetailsForm.controls).forEach(key => {
        const control = this.userDetailsForm.get(key);
        control.markAsTouched();
      });
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    const { firstName, lastName, email, password } = this.userDetailsForm.value;
    
    const loading = await this.loadingController.create({
      message: 'جاري إنشاء الحساب...',
      spinner: 'crescent'
    });
    await loading.present();
    
    // Prepare data for JWT registration
    const userData = {
      email: email,
      username: email, // Use email as username for WooCommerce
      password: password,
      first_name: firstName,
      last_name: lastName,
      meta_data: [
        {
          key: 'phone',
          value: this.phoneNumber
        },
        {
          key: 'phone_verified',
          value: 'yes'
        }
      ]
    };
    
    // Register using JWT auth service
    this.jwtAuthService.register(userData).subscribe({
      next: async (user) => {
        loading.dismiss();
        this.isSubmitting = false;
        
        // Registration successful
        const successAlert = await this.alertController.create({
          header: 'تم التسجيل بنجاح',
          message: 'تم إنشاء حسابك بنجاح وتم تسجيل دخولك تلقائياً.',
          buttons: [{
            text: 'تم',
            handler: () => {
              // Navigate to the return URL or home
              this.router.navigateByUrl(this.returnUrl);
            }
          }]
        });
        await successAlert.present();
      },
      error: (error) => {
        console.error('Registration error:', error);
        loading.dismiss();
        this.isSubmitting = false;
        
        let errorMessage = 'حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.';
        
        // Handle specific error cases
        if (error.status === 409) {
          errorMessage = 'البريد الإلكتروني مسجل بالفعل. يرجى استخدام بريد إلكتروني آخر.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.errorMessage = errorMessage;
        this.presentToast(errorMessage, 'danger');
      }
    });
  }
  
  // Start countdown for OTP resend
  startCountdown(seconds: number) {
    this.countdown = seconds;
    this.updateTimeLeft();
    this.resendDisabled = true;
    
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      this.updateTimeLeft();
      
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.resendDisabled = false;
      }
    }, 1000);
  }
  
  // Update the time left display
  updateTimeLeft() {
    const minutes = Math.floor(this.countdown / 60);
    const seconds = this.countdown % 60;
    this.timeLeft = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Resend OTP code
  async resendOTP() {
    if (this.resendDisabled) {
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    const loading = await this.loadingController.create({
      message: 'جاري إعادة إرسال رمز التحقق...',
      spinner: 'crescent'
    });
    await loading.present();
    
    const phoneValue = this.formatPhoneNumberForDisplay(this.phoneNumber);
    
    this.otpSendSubscription = this.otpService.sendOtp(phoneValue)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isSubmitting = false;
      }))
      .subscribe({
        next: (response) => {
          console.log('OTP resent successfully:', response);
          
          // Reset OTP fields
          this.otpDigits = ['', '', '', ''];
          
          // Start countdown again
          this.startCountdown(120);
          
          this.presentToast('تم إعادة إرسال رمز التحقق بنجاح', 'success');
        },
        error: (error) => {
          console.error('Error resending OTP:', error);
          
          this.errorMessage = error.message || 'فشل في إعادة إرسال رمز التحقق. يرجى المحاولة مرة أخرى.';
          this.presentToast(this.errorMessage, 'danger');
        }
      });
  }
  
  // Go back to the previous step
  goBack() {
    if (this.step === 'verify') {
      this.step = 'phone';
      this.errorMessage = '';
      
      // Clear countdown if active
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
    } else if (this.step === 'details') {
      this.step = 'verify';
      this.errorMessage = '';
    }
  }
  
  // Handle OTP paste event
  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;
    
    const pastedText = clipboardData.getData('text');
    if (!pastedText) return;
    
    // Extract only digits from pasted text
    const digits = pastedText.replace(/\D/g, '');
    
    // Fill in the OTP inputs with pasted digits
    for (let i = 0; i < Math.min(digits.length, this.otpDigits.length); i++) {
      this.otpDigits[i] = digits[i];
    }
    
    // Focus the next unfilled input, or the last one if all are filled
    const unfilled = this.otpDigits.findIndex(digit => !digit);
    setTimeout(() => {
      const index = unfilled >= 0 ? unfilled : this.otpDigits.length - 1;
      const inputElement = document.getElementById(`otp-${index}`);
      if (inputElement) {
        inputElement.focus();
      }
      
      // If all digits are filled, automatically verify
      if (this.otpDigits.every(digit => !!digit)) {
        setTimeout(() => this.verifyOTP(), 300);
      }
    }, 100);
  }
  
  // Handle input in OTP digit fields
  onOtpDigitInput(index: number, event: any) {
    const input = event.target.value;
    
    // Normalize Arabic/Persian/other numerals to Western numerals
    const normalizedInput = this.normalizeDigits(input);
    
    // Only allow a single digit
    if (/^\d$/.test(normalizedInput)) {
      this.otpDigits[index] = normalizedInput;
      
      // Auto-focus to next input
      if (index < 3) { // Changed from 5 to 3 for 4-digit OTP
        const nextInput = document.getElementById(`otp-${index + 1}`);
        if (nextInput) {
          nextInput.focus();
        }
      }
      
      // If all digits are filled, verify automatically
      if (this.otpDigits.every(digit => /^\d$/.test(digit))) {
        setTimeout(() => this.verifyOTP(), 300);
      }
    } else if (normalizedInput.length > 1) {
      // If multiple digits are entered, take only the last one
      const lastDigit = normalizedInput.slice(-1);
      if (/^\d$/.test(lastDigit)) {
        this.otpDigits[index] = lastDigit;
        
        // Auto-focus to next input
        if (index < 3) { // Changed from 5 to 3 for 4-digit OTP
          const nextInput = document.getElementById(`otp-${index + 1}`);
          if (nextInput) {
            nextInput.focus();
          }
        }
      } else {
        // Clear invalid input
        this.otpDigits[index] = '';
      }
    } else {
      // Clear invalid input
      this.otpDigits[index] = '';
    }
  }
  
  // Handle key down events for OTP input
  onOtpKeyDown(index: number, event: KeyboardEvent) {
    // If backspace and current field is empty, focus previous field
    if (event.key === 'Backspace' && !this.otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }
  }
  
  /**
   * Helper function to normalize Arabic/Persian/other numerals to Western numerals
   */
  private normalizeDigits(value: string): string {
    // Handle Arabic numerals (٠١٢٣٤٥٦٧٨٩)
    const arabicNumeralsMap = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    
    // Convert to Western numerals
    return value.replace(/[٠-٩]/g, match => arabicNumeralsMap[match] || match);
  }
  
  // Custom validator for password matching
  passwordMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('password').value;
    const confirmPassword = formGroup.get('confirmPassword').value;
    
    if (password !== confirmPassword) {
      formGroup.get('confirmPassword').setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      return null;
    }
  }
  
  // Format phone number to E.164 format for Saudi Arabia
  formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let digits = phone.replace(/\D/g, '');
    
    // Remove country code (966) if present
    if (digits.startsWith('966')) {
      digits = digits.substring(3);
    }
    
    // Remove leading zero if present
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    
    // Return with Saudi country code
    return '966' + digits;
  }
  
  // Format phone number for display (without country code)
  formatPhoneNumberForDisplay(phone: string): string {
    // Remove any non-digit characters
    let digits = phone.replace(/\D/g, '');
    
    // Remove country code (966) if present
    if (digits.startsWith('966')) {
      digits = digits.substring(3);
    }
    
    // Remove leading zero if present
    if (digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    
    return digits;
  }
  
  // Helper to present alerts
  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['حسناً']
    });
    
    await alert.present();
  }
  
  // Helper to present toasts
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
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