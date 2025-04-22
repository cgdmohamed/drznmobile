import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { PaymentService } from '../../services/payment.service';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-payment-callback',
  templateUrl: './payment-callback.page.html',
  styleUrls: ['./payment-callback.page.scss'],
})
export class PaymentCallbackPage implements OnInit {
  paymentId: string = '';
  status: string = 'processing';
  error: string = '';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService,
    private orderService: OrderService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    // Get query params from URL
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.paymentId = params['id'];
        this.verifyPayment();
      } else {
        this.status = 'error';
        this.error = 'لم يتم العثور على معلومات الدفع';
      }
    });
  }

  async verifyPayment() {
    const loading = await this.loadingController.create({
      message: 'جاري التحقق من حالة الدفع...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const paymentStatus = await this.paymentService.getPaymentStatus(this.paymentId).toPromise();
      
      if (paymentStatus.status === 'paid' || paymentStatus.status === 'authorized') {
        // Payment successful - update order status
        const orderId = localStorage.getItem('current_order_id');
        if (orderId) {
          await this.orderService.completePayment(+orderId, this.paymentId).toPromise();
          this.status = 'success';
          localStorage.removeItem('current_order_id');
          this.presentToast('تمت عملية الدفع بنجاح', 'success');
        } else {
          this.status = 'warning';
          this.error = 'تم الدفع بنجاح ولكن لم يتم العثور على معلومات الطلب';
        }
      } else {
        // Payment failed
        this.status = 'failed';
        this.error = paymentStatus.source?.message || 'فشلت عملية الدفع';
        this.presentToast('فشلت عملية الدفع: ' + this.error, 'danger');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      this.status = 'error';
      this.error = 'حدث خطأ أثناء التحقق من حالة الدفع';
      this.presentToast('حدث خطأ أثناء التحقق من حالة الدفع', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  goToOrders() {
    this.router.navigate(['/account/orders']);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color
    });
    toast.present();
  }
}