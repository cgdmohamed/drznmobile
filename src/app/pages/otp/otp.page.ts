import { Component, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { OtpService } from '../../services/otp.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.page.html',
  styleUrls: ['./otp.page.scss'],
})
export class OtpPage implements OnInit {
  @ViewChildren('otpDigitInput') otpDigits: QueryList<ElementRef>;
  
  phoneNumber: string = '';
  otpCode: string[] = ['', '', '', ''];
  isSubmitting: boolean = false;
  returnUrl: string = '/';
  otpSent: boolean = false;
  isRegistration: boolean = false;
  remainingTime: number = 0;
  resendEnabled: boolean = false;
  timerInterval: any;
  
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
      this.phoneNumber = phoneFromParams;
      // Automatically send OTP if phone number is provided
      setTimeout(() => {
        this.sendOtp();
      }, 500);
    }
    
    // If already authenticated, navigate to returnUrl
    if (this.authService.isLoggedIn) {
      this.router.navigate([this.returnUrl]);
    }
    
    // Set default phone number for testing if none provided
    // This allows direct access to the OTP page for testing
    if (!this.phoneNumber) {
      this.phoneNumber = '0500000000'; // Default testing number
    }
  }

  ngOnDestroy() {
    // Clear any timers when component is destroyed
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  async sendOtp() {
    if (!this.phoneNumber || this.phoneNumber.length < 9) {
      await this.showAlert('خطأ', 'يرجى إدخال رقم هاتف صالح');
      return;
    }
    
    this.isSubmitting = true;
    this.resendEnabled = false;
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري إرسال رمز التحقق...',
      spinner: 'circles'
    });
    await loading.present();
    
    this.otpService.sendOtp(this.phoneNumber)
      .pipe(finalize(() => {
        loading.dismiss();
        this.isSubmitting = false;
      }))
      .subscribe({
        next: (response) => {
          this.otpSent = true;
          
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
        },
        error: (error) => {
          console.error('OTP send error:', error);
          this.showAlert('خطأ', 'حدث خطأ أثناء إرسال رمز التحقق. يرجى المحاولة مرة أخرى لاحقًا.');
        }
      });
  }

  // Start a timer for OTP resend cooldown
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

  async verifyOtp() {
    const otpValue = this.otpCode.join('');
    
    console.log('Verifying OTP code:', otpValue);
    
    if (otpValue.length !== 4) {
      await this.showAlert('خطأ', 'يرجى إدخال رمز التحقق كاملاً');
      return;
    }
    
    this.isSubmitting = true;
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري التحقق من الرمز...',
      spinner: 'circles'
    });
    await loading.present();
    
    try {
      // Use the updated OTP service with proper validation
      const isVerified = await this.otpService.verifyOtp(otpValue);
      
      if (isVerified) {
        // Handle successful verification
        if (this.isRegistration) {
          await this.handleRegistration(loading);
        } else {
          await this.handleLogin(loading);
        }
      } else {
        loading.dismiss();
        this.isSubmitting = false;
        this.showAlert('خطأ', 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } catch (error) {
      loading.dismiss();
      this.isSubmitting = false;
      console.error('OTP verification error:', error);
      this.showAlert('خطأ', 'حدث خطأ أثناء التحقق من الرمز');
    }
  }

  // Handle registration after successful OTP verification
  private async handleRegistration(loading: HTMLIonLoadingElement) {
    // Get pending registration data
    const pendingRegistrationJSON = localStorage.getItem('pendingRegistration');
    
    if (!pendingRegistrationJSON) {
      loading.dismiss();
      this.isSubmitting = false;
      this.showAlert('خطأ', 'لم يتم العثور على بيانات التسجيل، يرجى المحاولة مرة أخرى.');
      return;
    }
    
    try {
      const pendingRegistration = JSON.parse(pendingRegistrationJSON);
      
      // Create a user account with phone number
      const userData = {
        first_name: pendingRegistration.first_name,
        last_name: pendingRegistration.last_name,
        email: pendingRegistration.email || `${this.phoneNumber}@darzn.com`, // Use provided email or generate one
        username: this.phoneNumber, // Use phone as username
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
          this.showAlert('خطأ في التسجيل', 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مرة أخرى.');
        }
      });
    } catch (error) {
      loading.dismiss();
      this.isSubmitting = false;
      console.error('Pending registration parse error:', error);
      this.showAlert('خطأ', 'حدث خطأ في بيانات التسجيل، يرجى المحاولة مرة أخرى.');
    }
  }
  
  // Handle login after successful OTP verification
  private async handleLogin(loading: HTMLIonLoadingElement) {
    loading.dismiss();
    this.isSubmitting = false;
    
    // Try to login with phone-based credentials
    const autoLoginEmail = `${this.phoneNumber}@darzn.com`;
    const autoLoginPwd = 'temporary_password'; // This is just for demonstration
    
    this.authService.login(autoLoginEmail, autoLoginPwd).subscribe({
      next: (loginResponse) => {
        this.presentToast('تم تسجيل الدخول بنجاح', 'success');
        this.router.navigate([this.returnUrl]);
      },
      error: (loginError) => {
        // If login fails, could mean the user needs to register first
        console.log('Login failed, redirecting to login page:', loginError);
        this.presentToast('تم التحقق من رقم الهاتف بنجاح، يرجى تسجيل الدخول', 'success');
        this.router.navigate(['/login']);
      }
    });
  }

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
    if (value && index < 3) {
      this.otpDigits.toArray()[index + 1].nativeElement.focus();
    }
    
    // If all digits are filled, automatically verify
    if (this.otpCode.every(digit => digit.length > 0)) {
      console.log('All digits entered, verifying:', this.otpCode.join(''));
      setTimeout(() => {
        this.verifyOtp();
      }, 300);
    }
  }
  
  // Helper function to normalize Arabic/Persian/other numerals to Western numerals
  private normalizeDigits(value: string): string {
    // Handle Arabic numerals (٠١٢٣٤٥٦٧٨٩)
    const arabicNumeralsMap = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    
    // Convert to Western numerals
    return value.replace(/[٠-٩]/g, match => arabicNumeralsMap[match] || match);
  }

  onKeyDown(index: number, event: KeyboardEvent) {
    // If backspace is pressed and current field is empty, focus previous field
    if (event.key === 'Backspace' && !this.otpCode[index] && index > 0) {
      this.otpDigits.toArray()[index - 1].nativeElement.focus();
    }
  }

  async resendOtp() {
    if (this.resendEnabled) {
      // Reset OTP code fields
      this.otpCode = ['', '', '', ''];
      // Send OTP again
      await this.sendOtp();
    }
  }

  goBack() {
    if (this.otpSent) {
      this.otpSent = false;
      this.otpCode = ['', '', '', ''];
      
      // Clear any active timers
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['حسنًا']
    });
    
    await alert.present();
  }
  
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
  
  // Format remaining time as MM:SS
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
