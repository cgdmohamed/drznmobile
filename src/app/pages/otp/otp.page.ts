import { Component, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { OtpService } from '../../services/otp.service';
import { AuthService } from '../../services/auth.service';

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
  
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private otpService: OtpService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
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

  async sendOtp() {
    if (!this.phoneNumber || this.phoneNumber.length < 9) {
      await this.showAlert('خطأ', 'يرجى إدخال رقم هاتف صالح');
      return;
    }
    
    this.isSubmitting = true;
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري إرسال رمز التحقق...'
    });
    await loading.present();
    
    this.otpService.sendOtp(this.phoneNumber).subscribe(
      response => {
        loading.dismiss();
        this.isSubmitting = false;
        this.otpSent = true;
        this.showAlert('تم الإرسال', 'تم إرسال رمز التحقق إلى رقم الهاتف المدخل');
        
        // Focus on first input
        setTimeout(() => {
          this.otpDigits.first.nativeElement.focus();
        }, 300);
      },
      error => {
        loading.dismiss();
        this.isSubmitting = false;
        this.showAlert('خطأ', 'حدث خطأ أثناء إرسال رمز التحقق');
      }
    );
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
      message: 'جاري التحقق من الرمز...'
    });
    await loading.present();
    
    // In a real app, this would call the backend to verify OTP
    // Here we'll use the local service method
    // For testing purposes, we'll accept '1234' as the valid OTP
    const isVerified = this.otpService.verifyOtp(otpValue);
    
    if (isVerified) {
      // Different flows for registration vs login
      if (this.isRegistration) {
        // Handle registration flow - get pending registration data
        const pendingRegistrationJSON = localStorage.getItem('pendingRegistration');
        
        if (pendingRegistrationJSON) {
          try {
            const pendingRegistration = JSON.parse(pendingRegistrationJSON);
            
            // Create a user account with phone number
            const userData = {
              first_name: pendingRegistration.first_name,
              last_name: pendingRegistration.last_name,
              email: `${this.phoneNumber}@darzn.com`, // Generate an email from phone
              username: this.phoneNumber, // Use phone as username
              password: 'Mobile' + Math.floor(100000 + Math.random() * 900000), // Generate a random password
              phone: this.phoneNumber
            };
            
            this.authService.register(userData).subscribe(
              async response => {
                loading.dismiss();
                this.isSubmitting = false;
                
                // Clear pending registration data
                localStorage.removeItem('pendingRegistration');
                
                const toast = await this.alertCtrl.create({
                  header: 'تم التسجيل بنجاح',
                  message: 'تم إنشاء حسابك بنجاح. يمكنك الآن استخدام التطبيق.',
                  buttons: [{
                    text: 'تم',
                    handler: () => {
                      this.router.navigate(['/home']);
                    }
                  }]
                });
                await toast.present();
              },
              error => {
                loading.dismiss();
                this.isSubmitting = false;
                this.showAlert('خطأ في التسجيل', 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مرة أخرى.');
                console.error('Registration error', error);
              }
            );
          } catch (error) {
            loading.dismiss();
            this.isSubmitting = false;
            this.showAlert('خطأ', 'حدث خطأ في بيانات التسجيل، يرجى المحاولة مرة أخرى.');
            console.error('Pending registration parse error', error);
          }
        } else {
          loading.dismiss();
          this.isSubmitting = false;
          this.showAlert('خطأ', 'لم يتم العثور على بيانات التسجيل، يرجى المحاولة مرة أخرى.');
        }
      } else {
        // Handle login flow
        loading.dismiss();
        this.isSubmitting = false;
        
        // Automatically login the user
        const autoLoginEmail = `${this.phoneNumber}@darzn.com`;
        const autoLoginPwd = 'temporary_password'; // This is just for demonstration
        
        // For simplicity, we'll try to login directly
        // In a real app, you would have a proper login flow
        this.authService.login(autoLoginEmail, autoLoginPwd).subscribe(
          loginResponse => {
            this.router.navigate([this.returnUrl]);
          },
          loginError => {
            // If login fails, could mean the user needs to register first
            this.showAlert('تم التحقق', 'تم التحقق من رقم الهاتف بنجاح، يرجى تسجيل الدخول');
            this.router.navigate(['/login']);
          }
        );
      }
    } else {
      loading.dismiss();
      this.isSubmitting = false;
      this.showAlert('خطأ', 'رمز التحقق غير صحيح');
    }
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

  goBack() {
    if (this.otpSent) {
      this.otpSent = false;
      this.otpCode = ['', '', '', ''];
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
}
