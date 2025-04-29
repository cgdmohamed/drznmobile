import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule, NavController, AlertController, Platform } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { User } from '../../interfaces/user.interface';
import { Subscription, combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';
import { ComponentsModule } from '../../components/components.module';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User | null = null;
  orderStatusTabs = ['in-progress', 'delivered', 'returned'];
  activeTab = 'in-progress';
  orders: any[] = [];
  private authSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private platform: Platform
  ) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  loadUserProfile() {
    // Use the JWT auth service first, and the legacy auth service as fallback
    const jwtUser$ = this.jwtAuthService.currentUser$;
    const legacyUser$ = this.authService.user;
    
    this.authSubscription = combineLatest([jwtUser$, legacyUser$]).subscribe(([jwtUser, legacyUser]) => {
      // Try JWT auth user first
      if (jwtUser) {
        this.user = jwtUser;
        return;
      }
      
      // Fall back to legacy auth user
      if (legacyUser) {
        this.user = legacyUser;
        return;
      }
      
      // If no user is found in either service, check storage directly
      this.checkStoredCredentials();
    });
  }
  
  async checkStoredCredentials() {
    try {
      const user = await this.jwtAuthService.getUser();
      if (user) {
        console.log('Found user in storage, restoring session');
        // Update the user subject
        this.jwtAuthService.setCurrentUser(user);
        this.user = user;
      } else {
        // If no user is found, redirect to login
        this.navCtrl.navigateRoot('/login');
      }
    } catch (error) {
      console.error('Error checking stored credentials', error);
      this.navCtrl.navigateRoot('/login');
    }
  }

  segmentChanged(event: any) {
    this.activeTab = event.detail.value;
  }

  goToPage(route: string) {
    this.navCtrl.navigateForward(route);
  }
  
  navigateToAddresses() {
    console.log('Attempting to navigate to addresses, current user:', this.user);
    
    // Check if user is authenticated and has a valid ID
    if (!this.user || !this.user.id || this.user.id === 0) {
      console.log('User has invalid ID, showing auth alert');
      this.presentAuthAlert();
      return;
    }
    
    // If user is valid, navigate to addresses page
    this.navCtrl.navigateForward('/addresses');
  }
  
  async presentAuthAlert() {
    const alert = await this.alertCtrl.create({
      header: 'تنبيه',
      message: 'يجب تسجيل الدخول أولاً للوصول إلى العناوين',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'تسجيل الدخول',
          handler: () => {
            this.navCtrl.navigateForward('/login');
          }
        }
      ]
    });
    await alert.present();
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'تسجيل الخروج',
      message: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
      cssClass: 'custom-alert',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          cssClass: 'secondary'
        }, {
          text: 'تأكيد',
          handler: () => {
            // Use JWT logout primarily, fall back to legacy logout if needed
            this.jwtAuthService.logout().subscribe({
              next: () => {
                console.log('JWT logout successful');
                this.navCtrl.navigateRoot('/login');
              },
              error: (error) => {
                console.error('JWT logout failed, trying legacy logout', error);
                // Fall back to legacy logout if JWT logout fails
                this.authService.logout();
                this.navCtrl.navigateRoot('/login');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Navigate to the contact page
   */
  navigateToContact() {
    this.navCtrl.navigateForward('/contact');
  }

  /**
   * Open the app store page to rate the app
   */
  rateApp() {
    const appId = this.platform.is('ios') ? 'id1234567890' : 'com.drzn.app';
    
    let storeUrl = '';
    if (this.platform.is('ios')) {
      storeUrl = `itms-apps://itunes.apple.com/app/${appId}?action=write-review`;
    } else if (this.platform.is('android')) {
      storeUrl = `market://details?id=${appId}`;
    } else {
      // Fallback to web URL if not on a mobile device
      storeUrl = `https://play.google.com/store/apps/details?id=${appId}`;
    }
    
    window.open(storeUrl, '_system');
  }

  /**
   * Share the app with others
   */
  shareApp() {
    const appName = 'تطبيق دزن';
    const appUrl = this.platform.is('ios') 
      ? 'https://apps.apple.com/app/id1234567890' 
      : 'https://play.google.com/store/apps/details?id=com.drzn.app';
    
    if (navigator.share) {
      navigator.share({
        title: appName,
        text: 'جرب تطبيق دزن للتسوق الإلكتروني!',
        url: appUrl
      }).catch((error) => {
        console.error('Error sharing:', error);
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      const tempInput = document.createElement('input');
      document.body.appendChild(tempInput);
      tempInput.value = appUrl;
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      
      this.presentToast('تم نسخ رابط التطبيق');
    }
  }

  /**
   * Open backend links for legal pages
   */
  openBackendLink(page: string) {
    const baseUrl = environment.apiUrl.split('/wp-json')[0];
    let pageUrl = '';
    
    switch (page) {
      case 'privacy-policy':
        pageUrl = `${baseUrl}/privacy-policy`;
        break;
      case 'terms-conditions':
        pageUrl = `${baseUrl}/terms-conditions`;
        break;
      case 'shipping-delivery':
        pageUrl = `${baseUrl}/shipping-delivery`;
        break;
      default:
        pageUrl = baseUrl;
    }
    
    window.open(pageUrl, '_system');
  }

  /**
   * Show a toast message
   */
  async presentToast(message: string) {
    const alert = await this.alertCtrl.create({
      header: 'نجاح',
      message: message,
      buttons: ['حسناً']
    });
    await alert.present();
  }
}