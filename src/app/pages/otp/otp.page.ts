import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController } from '@ionic/angular';
import { OtpService } from '../../services/otp.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.page.html',
  styleUrls: ['./otp.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OtpPage implements OnInit, OnDestroy {
  @ViewChildren('otpDigitInput') otpDigits: QueryList<ElementRef>;
  
  phoneNumber: string = '';
  otpCode: string[] = ['', '', '', '']; // 4-digit OTP
  isSubmitting: boolean = false;
  returnUrl: string = '/';
  otpSent: boolean = false;
  isRegistration: boolean = false;
  remainingTime: number = 0;
  resendEnabled: boolean = false;
  timerInterval: any;
  errorMessage: string = '';
  
  private otpSendSubscription: Subscription;
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private otpService: OtpService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
    // Get return URL from route parameters or default to '/'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    // Check if this is for registration or login
    this.isRegistration = this.route.snapshot.queryParams['isRegistration'] === 'true';
    
    // Get phone number from query params (coming from login with mobile)
    const phoneFromParams = this.route.snapshot.queryParams['phoneNumber'];
    if (phoneFromParams) {
      this.phoneNumber = this.sanitizePhoneNumber(phoneFromParams);
      // Automatically send OTP if phone number is provided and valid
      if (this.isValidPhoneNumber()) {
        setTimeout(() => {
          this.sendOtp();
        }, 500);
      }
    }
    
    // If already authenticated, navigate to returnUrl
    if (this.authService.isLoggedIn) {
      this.router.navigate([this.returnUrl]);
    }
  }

  ngOnDestroy() {
    // Clear any timers when component is destroyed
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    // Unsubscribe from any active subscriptions
    if (this.otpSendSubscription) {
      this.otpSendSubscription.unsubscribe();
    }
  }

  /**
   * Handle phone number input key press
   * Only allow numeric digits
   */
  onPhoneNumberKeyPress(event: KeyboardEvent): boolean {
    const charCode = event.which || event.keyCode;
    // Allow only numeric digits (0-9)
    return charCode >= 48 && charCode <= 57;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(): boolean {
    // Saudi mobile number must be 9 digits and start with 5
    return !!this.phoneNumber && 
           this.phoneNumber.length === 9 && 
           this.phoneNumber.startsWith('5');
  }

  /**
   * Validate OTP code format
   */
  isValidOtpCode(): boolean {
    // Must be a 4-digit code (all inputs filled)
    return this.otpCode.every(digit => !!digit);
  }

  /**
   * Clean and format phone number
   */
  private sanitizePhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove country code (966) if present
    if (cleaned.startsWith('966')) {
      cleaned = cleaned.substring(3);
    }
    
    // Remove leading zero if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  }

  /**
   * Send OTP to the provided phone number
   */
  async sendOtp() {
    if (!this.isValidPhoneNumber()) {
      this.errorMessage = 'يرجى إدخال رقم هاتف صالح يبدأ برقم 5';
      return;
    }
    
    this.isSubmitting = true;
    this.resendEnabled = false;
    this.errorMessage = '';
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري إرسال رمز التحقق...',
      spinner: 'circles'
    });
    await loading.present();
    
    this.otpSendSubscription = this.otpService.sendOtp(this.phoneNumber)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isSubmitting = false;
      }))
      .subscribe({
        next: (response) => {
          if (response.status === 'success') {
            this.otpSent = true;
            
            // Reset OTP code fields
            this.otpCode = ['', '', '', ''];
            
            // Set up cooldown timer for resend (2 minutes)
            this.remainingTime = 120;
            this.startResendTimer();
            
            // Focus on first input
            setTimeout(() => {
              if (this.otpDigits && this.otpDigits.first) {
                this.otpDigits.first.nativeElement.focus();
              }
            }, 300);
            
            this.presentToast('تم إرسال رمز التحقق إلى رقم الهاتف المدخل', 'success');
          } else {
            console.error('OTP send error:', response);
            this.errorMessage = response.message || 'حدث خطأ أثناء إرسال رمز التحقق';
          }
        },
        error: (error) => {
          console.error('OTP send error:', error);
          this.errorMessage = error.message || 'حدث خطأ أثناء إرسال رمز التحقق. يرجى المحاولة مرة أخرى لاحقًا.';
        }
      });
  }

  /**
   * Start a timer for OTP resend cooldown
   */
  startResendTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = setInterval(() => {
      this.remainingTime--;
      
      if (this.remainingTime <= 0) {
        this.resendEnabled = true;
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  /**
   * Verify the OTP code entered by user
   */
  async verifyOtp() {
    const otpValue = this.otpCode.join('');
    
    if (!this.isValidOtpCode()) {
      this.errorMessage = 'يرجى إدخال رمز التحقق كاملاً';
      return;
    }
    
    this.isSubmitting = true;
    this.errorMessage = '';
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري التحقق من الرمز...',
      spinner: 'circles'
    });
    await loading.present();
    
    try {
      // Get the phone number for verification
      const phoneNumber = this.phoneNumber;
      if (!phoneNumber) {
        throw new Error('رقم الهاتف غير متوفر');
      }
      
      // Use the updated OTP service with proper validation
      const response = await this.otpService.verifyOtp(phoneNumber, otpValue);
      
      if (response && response.status === 'success') {
        // Handle successful verification
        if (this.isRegistration) {
          await this.handleRegistration(loading);
        } else {
          await this.handleLogin(loading);
        }
      } else {
        loading.dismiss();
        this.isSubmitting = false;
        
        // Use the error message from the response or a default message
        this.errorMessage = (response && response.message) 
          ? response.message 
          : 'رمز التحقق غير صحيح أو منتهي الصلاحية';
      }
    } catch (error) {
      loading.dismiss();
      this.isSubmitting = false;
      console.error('OTP verification error:', error);
      
      // Extract error message if available
      if (error && typeof error === 'object' && 'message' in error) {
        this.errorMessage = error.message;
      } else {
        this.errorMessage = 'حدث خطأ أثناء التحقق من الرمز';
      }
    }
  }

  /**
   * Handle OTP paste event
   */
  onOtpPaste(event: ClipboardEvent) {
    event.preventDefault();
    
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;
    
    const pastedText = clipboardData.getData('text');
    if (!pastedText) return;
    
    // Extract only digits from pasted text
    const digits = pastedText.replace(/\D/g, '');
    
    // Fill in the OTP inputs with pasted digits
    for (let i = 0; i < Math.min(digits.length, this.otpCode.length); i++) {
      this.otpCode[i] = digits[i];
    }
    
    // Focus the next unfilled input, or the last one if all are filled
    const unfilled = this.otpCode.findIndex(digit => !digit);
    setTimeout(() => {
      const index = unfilled >= 0 ? unfilled : this.otpCode.length - 1;
      if (this.otpDigits && this.otpDigits.toArray()[index]) {
        this.otpDigits.toArray()[index].nativeElement.focus();
      }
      
      // If all digits are filled, automatically verify
      if (this.isValidOtpCode()) {
        setTimeout(() => this.verifyOtp(), 300);
      }
    }, 100);
  }

  /**
   * Handle registration after successful OTP verification
   */
  private async handleRegistration(loading: HTMLIonLoadingElement) {
    // Get pending registration data
    const pendingRegistrationJSON = localStorage.getItem('pendingRegistration');
    
    if (!pendingRegistrationJSON) {
      loading.dismiss();
      this.isSubmitting = false;
      this.errorMessage = 'لم يتم العثور على بيانات التسجيل، يرجى المحاولة مرة أخرى.';
      return;
    }
    
    try {
      const pendingRegistration = JSON.parse(pendingRegistrationJSON);
      
      // Create a user account with phone number
      const userData = {
        first_name: pendingRegistration.first_name || pendingRegistration.firstName || 'مستخدم',
        last_name: pendingRegistration.last_name || pendingRegistration.lastName || 'جديد',
        email: pendingRegistration.email || `${this.phoneNumber}@drzn.com`, // Use provided email or generate one
        username: `mobile_${this.phoneNumber}`, // Use phone as username with prefix
        password: 'Mobile' + Math.floor(100000 + Math.random() * 900000), // Generate a secure random password
        phone: this.phoneNumber
      };
      
      this.authService.register(userData).subscribe({
        next: async (response) => {
          loading.dismiss();
          this.isSubmitting = false;
          
          // Clear pending registration data
          localStorage.removeItem('pendingRegistration');
          
          const alert = await this.alertCtrl.create({
            header: 'تم التسجيل بنجاح',
            message: 'تم إنشاء حسابك بنجاح. يمكنك الآن استخدام التطبيق.',
            buttons: [{
              text: 'تم',
              handler: () => {
                this.router.navigate(['/home']);
              }
            }]
          });
          await alert.present();
        },
        error: (error) => {
          loading.dismiss();
          this.isSubmitting = false;
          console.error('Registration error:', error);
          this.errorMessage = 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مرة أخرى.';
        }
      });
    } catch (error) {
      loading.dismiss();
      this.isSubmitting = false;
      console.error('Pending registration parse error:', error);
      this.errorMessage = 'حدث خطأ في بيانات التسجيل، يرجى المحاولة مرة أخرى.';
    }
  }
  
  /**
   * Handle login after successful OTP verification
   */
  private async handleLogin(loading: HTMLIonLoadingElement) {
    loading.dismiss();
    this.isSubmitting = false;
    
    // Try to login with phone-based credentials
    // For most implementations, we'd need to implement a special login flow on the backend
    // that accepts a verified phone number as authentication
    // Here we'll just redirect to login page with a success message
    
    this.presentToast('تم التحقق من رقم الهاتف بنجاح', 'success');
    
    // Redirect to home page or requested page
    this.router.navigate([this.returnUrl || '/home']);
  }

  /**
   * Handle OTP digit input change
   */
  otpDigitInputChanged(index: number, event: any) {
    // Get the value from the event target
    let value = event.target.value;
    
    // Normalize Arabic/Eastern numerals to Western numerals if needed
    value = this.normalizeDigits(value);
    
    // Ensure we only take the last digit if multiple are entered
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    // Update the current digit
    this.otpCode[index] = value;
    
    // Update the field value in case it was normalized
    if (this.otpDigits) {
      const inputElement = this.otpDigits.toArray()[index].nativeElement;
      if (inputElement.value !== value) {
        inputElement.value = value;
      }
    }
    
    // If a digit was entered and there is a next input, focus it
    if (value && index < this.otpCode.length - 1) {
      this.otpDigits.toArray()[index + 1].nativeElement.focus();
    }
    
    // If all digits are filled, automatically verify
    if (this.isValidOtpCode()) {
      console.log('All digits entered, verifying:', this.otpCode.join(''));
      setTimeout(() => {
        this.verifyOtp();
      }, 300);
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

  /**
   * Handle keyboard key down events in OTP input
   */
  onKeyDown(index: number, event: KeyboardEvent) {
    // If backspace is pressed and current field is empty, focus previous field
    if (event.key === 'Backspace' && !this.otpCode[index] && index > 0) {
      this.otpDigits.toArray()[index - 1].nativeElement.focus();
    }
  }

  /**
   * Resend OTP code
   */
  async resendOtp() {
    if (this.resendEnabled) {
      // Reset OTP code fields
      this.otpCode = ['', '', '', ''];
      // Send OTP again
      await this.sendOtp();
    }
  }

  /**
   * Go back to previous screen or change state
   */
  goBack(event?: Event) {
    // Prevent default behavior of ion-back-button if provided
    if (event) {
      event.preventDefault();
    }
    
    if (this.otpSent) {
      this.otpSent = false;
      this.otpCode = ['', '', '', ''];
      this.errorMessage = '';
      
      // Clear any active timers
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Change phone number (go back to phone input screen)
   */
  changePhoneNumber() {
    this.otpSent = false;
    this.otpCode = ['', '', '', ''];
    this.errorMessage = '';
    
    // Clear any active timers
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  /**
   * Show alert dialog
   */
  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['حسنًا']
    });
    
    await alert.present();
  }
  
  /**
   * Present toast notification
   */
  async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
      buttons: [
        {
          text: 'إغلاق',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }
  
  /**
   * Format remaining time as MM:SS
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}