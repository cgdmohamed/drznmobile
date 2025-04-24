import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { RegisterService } from '../../services/register.service';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.page.html',
  styleUrls: ['./otp.page.scss'],
})
export class OtpPage implements OnInit {
  otpForm: FormGroup;
  isLoading = false;
  verificationId: string | null = null;
  mobileNumber: string | null = null;
  nextAction: string | null = null;
  
  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private registerService: RegisterService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    this.otpForm = this.formBuilder.group({
      otp: ['', [Validators.required, Validators.pattern(/^[0-9]{4,6}$/)]]
    });
  }

  ngOnInit() {
    // Get verification ID and mobile number from route params or queryParams
    this.route.queryParams.subscribe(params => {
      if (params['verificationId']) {
        this.verificationId = params['verificationId'];
      }
      
      if (params['mobile']) {
        this.mobileNumber = params['mobile'];
      }
      
      if (params['nextAction']) {
        this.nextAction = params['nextAction'];
      }
    });
    
    // Check if we need to send the OTP
    if (this.mobileNumber && !this.verificationId) {
      this.sendOtp();
    }
  }

  /**
   * Send OTP to the mobile number
   */
  async sendOtp() {
    if (!this.mobileNumber) {
      this.presentAlert('Error', 'Mobile number is required');
      return;
    }
    
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Sending OTP...',
      spinner: 'crescent'
    });
    await loading.present();
    
    this.registerService.sendOtp(this.mobileNumber)
      .subscribe({
        next: (response) => {
          loading.dismiss();
          this.isLoading = false;
          
          if (response.success) {
            this.verificationId = response.data?.verification_id || null;
            this.presentToast('OTP sent successfully');
          } else {
            this.presentAlert('Error', response.error || 'Failed to send OTP');
          }
        },
        error: (error) => {
          loading.dismiss();
          this.isLoading = false;
          this.presentAlert('Error', error.message || 'Failed to send OTP');
        }
      });
  }

  /**
   * Verify OTP
   */
  async verifyOtp() {
    if (this.otpForm.invalid || !this.verificationId || !this.mobileNumber) {
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
      this.otpForm.value.otp,
      this.verificationId
    ).subscribe({
      next: (response) => {
        loading.dismiss();
        this.isLoading = false;
        
        if (response.success) {
          this.presentToast('OTP verified successfully');
          
          // Handle next action based on the flow
          if (this.nextAction === 'register') {
            this.router.navigate(['/register'], {
              queryParams: {
                mobile: this.mobileNumber,
                verified: true
              }
            });
          } else if (this.nextAction === 'login') {
            this.router.navigate(['/login'], {
              queryParams: {
                mobile: this.mobileNumber,
                verified: true
              }
            });
          } else if (this.nextAction === 'reset-password') {
            this.router.navigate(['/reset-password'], {
              queryParams: {
                mobile: this.mobileNumber,
                verified: true
              }
            });
          } else {
            // Default action - go back to auth
            this.router.navigate(['/auth']);
          }
        } else {
          this.presentAlert('Error', response.error || 'OTP verification failed');
        }
      },
      error: (error) => {
        loading.dismiss();
        this.isLoading = false;
        this.presentAlert('Error', error.message || 'OTP verification failed');
      }
    });
  }

  /**
   * Present a toast message
   * @param message Message to display
   */
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: 'dark'
    });
    await toast.present();
  }

  /**
   * Present an alert message
   * @param header Alert header
   * @param message Alert message
   */
  async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }
}