import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
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
  isAdmin = false;
  private userSubscription: Subscription;
  private themeSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private orderService: OrderService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private themeService: ThemeService
  ) {
    console.log('Account page constructor - checking JWT authentication');
    // Check if we're authenticated via JWT
    if (this.jwtAuthService.isAuthenticated) {
      console.log('JWT authentication confirmed in account constructor');
    } else {
      console.log('Not authenticated via JWT in account constructor');
    }
  }

  ngOnInit() {
    this.isLoading = true;
    
    // Subscribe to both authentication services to handle transition from old to new
    this.userSubscription = this.jwtAuthService.currentUser$.subscribe(jwtUser => {
      console.log('Account page - JWT user update received:', jwtUser);
      
      // If we have a JWT user, prioritize it
      if (jwtUser) {
        this.user = jwtUser;
        console.log('Account page - Using JWT user:', jwtUser.id);
        this.loadUserOrders(jwtUser.id);
        this.checkAdminStatus(jwtUser);
      } else {
        // Fallback to regular auth service if no JWT user
        console.log('Account page - No JWT user, checking regular auth');
        const regularUser = this.authService.userValue;
        
        if (regularUser) {
          this.user = regularUser;
          console.log('Account page - Using regular auth user:', regularUser.id);
          this.loadUserOrders(regularUser.id);
          this.checkAdminStatus(regularUser);
        } else {
          console.log('Account page - No authenticated user found');
          this.recentOrders = [];
          this.isLoading = false;
        }
      }
    });
    
    this.themeSubscription = this.themeService.darkMode.subscribe(isDark => {
      this.darkMode = isDark;
    });
    
    this.textSize = this.themeService.getTextSize();
  }
  
  /**
   * Check if user has admin role
   */
  checkAdminStatus(user: User) {
    // Check for administrator or shop_manager role
    if (user && user.role) {
      this.isAdmin = user.role === 'administrator' || user.role === 'shop_manager';
      console.log(`Account page - Admin status: ${this.isAdmin}`);
    } else {
      this.isAdmin = false;
    }
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
    if (!userId) {
      console.error('Cannot load orders: No user ID provided');
      this.isLoading = false;
      return;
    }
    
    console.log('Account page - Loading orders for user ID:', userId);
    
    this.orderService.getCustomerOrders(userId).subscribe({
      next: (orders) => {
        console.log('Account page - Orders loaded successfully, total:', orders.length);
        this.recentOrders = orders.slice(0, 3); // Show only the 3 most recent orders
        console.log('Account page - Recent orders:', this.recentOrders.length);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching orders in account page:', error);
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