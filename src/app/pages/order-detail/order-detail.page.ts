import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OrderService } from '../../services/order.service';
import { Order } from '../../interfaces/order.interface';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.page.html',
  styleUrls: ['./order-detail.page.scss'],
})
export class OrderDetailPage implements OnInit {
  order: Order | null = null;
  isLoading = true;
  orderId: number;
  statusUpdating = false;

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
      },
      error: (error) => {
        console.error('Error fetching order details:', error);
        loading.dismiss();
        this.isLoading = false;
        this.presentToast('حدث خطأ أثناء تحميل تفاصيل الطلب');
      }
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
  
  async requestCancellation() {
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
          handler: () => {
            this.updateOrderStatus('cancelled');
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
}