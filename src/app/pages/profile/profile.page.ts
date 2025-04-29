import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule, NavController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { User } from '../../interfaces/user.interface';
import { Subscription, combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';
import { ComponentsModule } from '../../components/components.module';

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
    private alertCtrl: AlertController
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
    
    // Just navigate to addresses page - the page itself will handle authentication checks
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

  async deleteAccount() {
    const alert = await this.alertCtrl.create({
      header: 'حذف الحساب',
      message: 'هل أنت متأكد من رغبتك في حذف حسابك؟ لا يمكن التراجع عن هذه العملية.',
      cssClass: 'custom-alert',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          cssClass: 'secondary'
        }, {
          text: 'حذف',
          cssClass: 'danger',
          handler: () => {
            // This would typically call a service method to delete the account
            // For now, we'll just logout the user
            this.jwtAuthService.logout().subscribe({
              next: () => {
                console.log('Account deletion requested, logged out');
                this.navCtrl.navigateRoot('/login');
              },
              error: (error) => {
                console.error('Error during account deletion process', error);
                // Fall back to legacy logout
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
}