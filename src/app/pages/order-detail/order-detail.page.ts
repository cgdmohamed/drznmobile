import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService, OrderStatus } from '../../services/order.service';
import { Order } from '../../interfaces/order.interface';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyIconComponent } from '../../components/currency-icon/currency-icon.component';
import { OrderTimelineComponent } from '../../components/order-timeline/order-timeline.component';

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.page.html',
  styleUrls: ['./order-detail.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterLink,
    CurrencyIconComponent,
    OrderTimelineComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OrderDetailPage implements OnInit, OnDestroy {
  // Add parseFloat method for template use
  parseFloat(value: string | number): number {
    return typeof value === 'string' ? Number.parseFloat(value) : value;
  }
  
  order: Order | null = null;
  isLoading = true;
  orderId: number;
  statusUpdating = false;
  isTracking = false;
  trackingSubscription?: Subscription;
  isWithinCancellationWindow = false;
  cancellationWindowMinutes = 1; // 1 minute window for cancellation

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) { 
    this.orderId = +this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit() {
    this.loadOrderDetails();
  }

  async loadOrderDetails() {
    this.isLoading = true;
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري تحميل تفاصيل الطلب...',
      spinner: 'crescent'
    });
    await loading.present();
    
    this.orderService.getOrder(this.orderId).subscribe({
      next: (order) => {
        this.order = order;
        loading.dismiss();
        this.isLoading = false;
        
        // Check if the order is within the cancellation window
        this.checkCancellationWindow(order);
        
        // Start tracking if the order is in a non-final state
        this.startOrderTracking();
      },
      error: (error) => {
        console.error('Error fetching order details:', error);
        loading.dismiss();
        this.isLoading = false;
        this.presentToast('حدث خطأ أثناء تحميل تفاصيل الطلب');
      }
    });
  }
  
  /**
   * Check if the order is within the cancellation window
   * @param order The order to check
   */
  private checkCancellationWindow(order: Order) {
    if (!order || !order.date_created) return;
    
    // Check if order is in a cancelable state
    const cancelableStatuses = ['pending', 'processing', 'on-hold'];
    if (!cancelableStatuses.includes(order.status)) {
      this.isWithinCancellationWindow = false;
      return;
    }
    
    // Calculate time difference
    const orderDate = new Date(order.date_created);
    const now = new Date();
    const diffMinutes = (now.getTime() - orderDate.getTime()) / (1000 * 60);
    
    // Check if within window
    this.isWithinCancellationWindow = diffMinutes <= this.cancellationWindowMinutes;
    
    console.log(
      `Order is ${this.isWithinCancellationWindow ? 'within' : 'outside'} cancellation window. ` +
      `Time since order: ${diffMinutes.toFixed(2)} minutes. Window: ${this.cancellationWindowMinutes} minutes.`
    );
  }
  
  /**
   * Start tracking the order status for changes
   */
  startOrderTracking() {
    // If we're already tracking, don't start again
    if (this.isTracking || !this.order) return;
    
    // Don't track if order is in a final state
    const finalStatuses = ['completed', 'cancelled', 'refunded', 'failed', 'trash'];
    if (finalStatuses.includes(this.order.status)) {
      console.log(`Order ${this.orderId} is already in final state: ${this.order.status}. No tracking needed.`);
      return;
    }
    
    console.log(`Starting to track order ${this.orderId} status...`);
    this.isTracking = true;
    
    // Start tracking with updates every 30 seconds for up to 60 minutes
    this.trackingSubscription = this.orderService.trackOrderStatus(this.orderId, 30, 60)
      .subscribe({
        next: (updatedOrder) => {
          if (!updatedOrder) return;
          
          console.log(`Received updated order: Status = ${updatedOrder.status}`);
          this.order = updatedOrder;
          
          // Re-check cancellation window as time passes
          this.checkCancellationWindow(updatedOrder);
        },
        error: (error) => {
          console.error('Error tracking order status:', error);
          this.isTracking = false;
        },
        complete: () => {
          console.log('Order tracking completed');
          this.isTracking = false;
        }
      });
  }
  
  /**
   * Stop tracking the order status
   */
  stopOrderTracking() {
    if (this.trackingSubscription) {
      this.trackingSubscription.unsubscribe();
      this.trackingSubscription = undefined;
    }
    this.isTracking = false;
    console.log('Order tracking stopped');
  }

  getOrderStatusClass(status: string): string {
    return this.orderService.getStatusColor(status as OrderStatus);
  }
  
  getOrderStatusText(status: string): string {
    return this.orderService.getStatusLabel(status as OrderStatus);
  }
  
  getOrderStatusIcon(status: string): string {
    return this.orderService.getStatusIcon(status as OrderStatus);
  }
  
  isOrderStatusFinal(status: string): boolean {
    return this.orderService.isOrderStatusFinal(status as OrderStatus);
  }
  
  getOrderStatusDescription(status: string): string {
    return this.orderService.getOrderStatusInfo(status as OrderStatus).description;
  }
  
  // Used in templates for backward compatibility
  _getOrderStatusText(status: string): string {
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
  
  async requestCancellation() {
    // Check if within cancellation window
    if (!this.isWithinCancellationWindow) {
      const alert = await this.alertCtrl.create({
        header: 'انتهت مهلة الإلغاء',
        message: `لا يمكن إلغاء الطلب بعد مرور ${this.cancellationWindowMinutes} دقيقة من وقت الطلب. يرجى التواصل مع خدمة العملاء للمساعدة.`,
        buttons: ['حسناً']
      });
      
      await alert.present();
      return;
    }
    
    // Show confirmation alert
    const alert = await this.alertCtrl.create({
      header: 'تأكيد إلغاء الطلب',
      message: 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟',
      cssClass: 'custom-alert',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          cssClass: 'secondary'
        }, {
          text: 'تأكيد',
          handler: async () => {
            const loading = await this.loadingCtrl.create({
              message: 'جاري إلغاء الطلب...',
              spinner: 'crescent'
            });
            await loading.present();
            
            try {
              // Use the new cancelOrder method
              const success = await this.orderService.cancelOrder(this.orderId, this.cancellationWindowMinutes);
              
              if (success && this.order) {
                // Update local order status
                this.order.status = 'cancelled';
                this.isWithinCancellationWindow = false;
                
                // Stop tracking as order reached final state
                this.stopOrderTracking();
              }
              
              loading.dismiss();
            } catch (error) {
              console.error('Error cancelling order:', error);
              loading.dismiss();
              this.presentToast('حدث خطأ أثناء محاولة إلغاء الطلب');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }
  
  async updateOrderStatus(status: string) {
    this.statusUpdating = true;
    
    const loading = await this.loadingCtrl.create({
      message: 'جاري تحديث حالة الطلب...',
      spinner: 'crescent'
    });
    await loading.present();
    
    this.orderService.updateOrderStatus(this.orderId, status).subscribe({
      next: (updatedOrder) => {
        this.order = updatedOrder;
        loading.dismiss();
        this.statusUpdating = false;
        this.presentToast('تم تحديث حالة الطلب بنجاح');
      },
      error: (error) => {
        console.error('Error updating order status:', error);
        loading.dismiss();
        this.statusUpdating = false;
        this.presentToast('حدث خطأ أثناء تحديث حالة الطلب');
      }
    });
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
    this.loadOrderDetails().then(() => {
      event.target.complete();
    });
  }
  
  getFormattedDate(dateString: string): string {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  /**
   * Clean up subscriptions when component is destroyed
   */
  ngOnDestroy() {
    // Unsubscribe from tracking subscription to prevent memory leaks
    if (this.trackingSubscription) {
      this.trackingSubscription.unsubscribe();
    }
  }
}