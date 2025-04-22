import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { User } from '../../interfaces/user.interface';
import { Order } from '../../interfaces/order.interface';
import { ToastController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  standalone: false
})
export class AccountPage implements OnInit, OnDestroy {
  user: User | null = null;
  recentOrders: Order[] = [];
  darkMode: boolean = false;
  textSize: string = 'medium';
  isLoading = true;
  private userSubscription: Subscription;
  private themeSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private themeService: ThemeService
  ) { }

  ngOnInit() {
    this.isLoading = true;
    
    this.userSubscription = this.authService.user.subscribe(user => {
      this.user = user;
      
      if (user) {
        this.loadUserOrders(user.id);
      } else {
        this.recentOrders = [];
        this.isLoading = false;
      }
    });
    
    this.themeSubscription = this.themeService.darkMode.subscribe(isDark => {
      this.darkMode = isDark;
    });
    
    this.textSize = this.themeService.getTextSize();
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  loadUserOrders(userId: number) {
    if (!userId) return;
    
    this.orderService.getCustomerOrders(userId).subscribe({
      next: (orders) => {
        this.recentOrders = orders.slice(0, 3); // Show only the 3 most recent orders
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching orders:', error);
        this.isLoading = false;
      }
    });
  }

  login() {
    this.router.navigate(['/login']);
  }

  logout() {
    this.alertController.create({
      header: 'تسجيل الخروج',
      message: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'تسجيل الخروج',
          handler: () => {
            this.authService.logout();
            this.presentToast('تم تسجيل الخروج بنجاح');
          }
        }
      ]
    }).then(alert => alert.present());
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }

  changeTextSize(size: string) {
    this.textSize = size;
    this.themeService.setTextSize(size);
    this.presentToast('تم تغيير حجم النص');
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      cssClass: 'custom-toast'
    });
    await toast.present();
  }
}