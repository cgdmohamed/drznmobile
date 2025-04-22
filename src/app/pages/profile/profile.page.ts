import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/user.interface';
import { NavController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
  user: User | null = null;
  orderStatusTabs = ['in-progress', 'delivered', 'returned'];
  activeTab = 'in-progress';

  constructor(
    private authService: AuthService,
    private navCtrl: NavController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    this.authService.user.subscribe(user => {
      this.user = user;
      if (!user) {
        this.navCtrl.navigateRoot('/login');
      }
    });
  }

  segmentChanged(event: any) {
    this.activeTab = event.detail.value;
  }

  goToPage(route: string) {
    this.navCtrl.navigateForward(route);
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
            this.authService.logout();
            this.navCtrl.navigateRoot('/login');
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
            this.authService.logout();
            this.navCtrl.navigateRoot('/login');
          }
        }
      ]
    });
    await alert.present();
  }
}