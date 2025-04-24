import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
})
export class ForgotPasswordPage implements OnInit {
  forgotPasswordForm: FormGroup;
  resetError: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.initForm();
  }

  // Initialize forgot password form
  initForm() {
    this.forgotPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  // Handle password reset request
  async resetPassword() {
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    const { email } = this.forgotPasswordForm.value;
    
    const loading = await this.loadingController.create({
      message: 'جاري إرسال الطلب...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    // Try JWT password reset first
    this.jwtAuthService.requestPasswordReset(email).subscribe({
      next: (response) => {
        loading.dismiss();
        this.presentSuccessAlert();
      },
      error: (error) => {
        console.log('JWT password reset failed, trying legacy reset...', error);
        
        // Fallback to legacy password reset if JWT fails
        this.authService.forgotPassword(email).subscribe({
          next: (response) => {
            loading.dismiss();
            this.presentSuccessAlert();
          },
          error: (err) => {
            loading.dismiss();
            this.resetError = 'حدث خطأ أثناء محاولة إعادة تعيين كلمة المرور. الرجاء المحاولة مرة أخرى.';
            console.error('Password reset error', err);
          }
        });
      }
    });
  }

  // Present success alert
  async presentSuccessAlert() {
    const alert = await this.alertController.create({
      header: 'تم إرسال رابط إعادة التعيين',
      message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد الخاص بك.',
      buttons: [
        {
          text: 'العودة لتسجيل الدخول',
          handler: () => {
            this.router.navigateByUrl('/login');
          }
        }
      ]
    });

    await alert.present();
  }

  // Navigate to login page
  goToLogin() {
    this.router.navigateByUrl('/login');
  }
}