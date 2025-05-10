import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { Order } from '../../interfaces/order.interface';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.page.html',
  styleUrls: ['./orders.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OrdersPage implements OnInit {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  isLoading = false;
  activeFilter = 'all';
  
  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) { 
    console.log('Orders page constructor - checking authentication');
    // Check if we're authenticated via JWT
    if (this.jwtAuthService.isAuthenticated) {
      console.log('JWT authentication confirmed in orders constructor');
    } else {
      console.log('Not authenticated via JWT in orders constructor');
    }
  }

  ngOnInit() {
    this.loadOrders();
  }

  async loadOrders() {
    this.isLoading = true;
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري تحميل الطلبات...',
      spinner: 'crescent'
    });
    await loading.present();
    
    // Use JWTAuthService to check if user is authenticated
    const jwtUser = this.jwtAuthService.currentUserValue;
    console.log('Orders page - JWT authenticated user:', jwtUser);
    
    if (!jwtUser || !jwtUser.id) {
      console.error('JWT user validation failed in orders page:', jwtUser);
      loading.dismiss();
      this.isLoading = false;
      this.presentToast('يرجى تسجيل الدخول أولاً');
      return;
    }
    
    const userId = jwtUser.id;
    console.log('Fetching orders for user ID:', userId);
    
    // Load orders with a fallback to demo orders when needed
    this.orderService.getCustomerOrders(userId).subscribe({
      next: (orders) => {
        console.log('Orders loaded successfully, count:', orders.length);
        this.orders = orders;
        this.filterOrders(this.activeFilter);
        loading.dismiss();
        this.isLoading = false;
        
        // Show toast if no orders found
        if (orders.length === 0) {
          this.presentToast('لا توجد طلبات سابقة');
        }
      },
      error: (error) => {
        console.error('Error fetching orders:', error);
        loading.dismiss();
        this.isLoading = false;
        this.presentToast('حدث خطأ أثناء تحميل الطلبات');
      }
    });
  }

  filterOrders(status: any) {
    // Ensure status is always a string
    const statusStr = String(status);
    this.activeFilter = statusStr;
    
    if (statusStr === 'all') {
      this.filteredOrders = [...this.orders];
      return;
    }
    
    this.filteredOrders = this.orders.filter(order => {
      if (statusStr === 'processing') {
        return ['pending', 'processing', 'on-hold'].includes(order.status);
      } else if (statusStr === 'completed') {
        return order.status === 'completed';
      } else if (statusStr === 'cancelled') {
        return ['cancelled', 'refunded', 'failed'].includes(order.status);
      }
      return true;
    });
  }
  
  getOrderStatusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
      case 'pending':
        return 'warning';
      case 'on-hold':
        return 'tertiary';
      case 'cancelled':
      case 'refunded':
      case 'failed':
        return 'danger';
      default:
        return 'medium';
    }
  }
  
  getOrderStatusText(status: string): string {
    switch (status) {
      case 'completed':
        return 'مكتمل';
      case 'processing':
        return 'قيد المعالجة';
      case 'pending':
        return 'قيد الانتظار';
      case 'on-hold':
        return 'معلق';
      case 'cancelled':
        return 'ملغي';
      case 'refunded':
        return 'مسترجع';
      case 'failed':
        return 'فشل';
      default:
        return status;
    }
  }

  async presentToast(message: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
  
  doRefresh(event: any) {
    this.loadOrders().then(() => {
      event.target.complete();
    });
  }
}