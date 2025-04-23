import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { NotificationService, NotificationData } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: NotificationData[] = [];
  isLoading = true;
  private notificationsSubscription: Subscription;

  constructor(
    private notificationService: NotificationService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loadNotifications();
  }

  ngOnDestroy() {
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
  }

  loadNotifications() {
    this.isLoading = true;
    this.notificationsSubscription = this.notificationService.notifications.subscribe(
      (notifications) => {
        this.notifications = notifications;
        this.isLoading = false;
      }
    );
  }

  doRefresh(event) {
    this.loadNotifications();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  async markAsRead(notification: NotificationData) {
    await this.notificationService.markNotificationAsRead(notification.id);
    this.presentToast('تم تحديد الإشعار كمقروء');
  }

  async markAllAsRead() {
    const alert = await this.alertController.create({
      header: 'تحديد الكل كمقروء',
      message: 'هل أنت متأكد من تحديد جميع الإشعارات كمقروءة؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'تحديد الكل',
          handler: async () => {
            await this.notificationService.markAllNotificationsAsRead();
            this.presentToast('تم تحديد جميع الإشعارات كمقروءة');
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteNotification(notification: NotificationData) {
    const alert = await this.alertController.create({
      header: 'حذف الإشعار',
      message: 'هل أنت متأكد من حذف هذا الإشعار؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حذف',
          handler: async () => {
            await this.notificationService.deleteNotification(notification.id);
            this.presentToast('تم حذف الإشعار');
          }
        }
      ]
    });

    await alert.present();
  }

  async clearAllNotifications() {
    const alert = await this.alertController.create({
      header: 'حذف جميع الإشعارات',
      message: 'هل أنت متأكد من حذف جميع الإشعارات؟ لا يمكن التراجع عن هذا الإجراء.',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حذف الكل',
          handler: async () => {
            await this.notificationService.clearAllNotifications();
            this.presentToast('تم حذف جميع الإشعارات');
          }
        }
      ]
    });

    await alert.present();
  }

  getNotificationIcon(notification: NotificationData): string {
    const type = notification.type || 'general';
    
    switch (type) {
      case 'order':
        return 'cart';
      case 'product':
        return 'pricetag';
      case 'category':
        return 'list';
      case 'special_offer':
        return 'gift';
      case 'account':
        return 'person';
      default:
        return 'notifications';
    }
  }

  getNotificationTime(notification: NotificationData): string {
    const receivedDate = new Date(notification.receivedAt);
    const now = new Date();
    const diffInMs = now.getTime() - receivedDate.getTime();
    const diffInMin = Math.round(diffInMs / 60000);
    const diffInHours = Math.round(diffInMs / 3600000);
    const diffInDays = Math.round(diffInMs / 86400000);

    if (diffInMin < 60) {
      return diffInMin === 1 ? 'منذ دقيقة واحدة' : `منذ ${diffInMin} دقائق`;
    } else if (diffInHours < 24) {
      return diffInHours === 1 ? 'منذ ساعة واحدة' : `منذ ${diffInHours} ساعات`;
    } else if (diffInDays < 7) {
      return diffInDays === 1 ? 'منذ يوم واحد' : `منذ ${diffInDays} أيام`;
    } else {
      // Format the date in Arabic-friendly format
      return receivedDate.toLocaleDateString('ar-SA');
    }
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });

    await toast.present();
  }
  
  /**
   * Generate a test notification for demonstration purposes
   * @param type The type of notification to generate
   */
  generateTestNotification(type: string = 'general') {
    // Generate a realistic-looking notification based on type
    const now = new Date();
    let title = 'New Notification';
    let body = 'This is a test notification.';
    let actionData: any = {};
    
    switch(type) {
      case 'order':
        title = 'تم شحن طلبك';
        body = 'طلبك رقم #12345 قيد الشحن. سيصلك خلال 3-5 أيام عمل.';
        actionData = { orderId: 12345 };
        break;
        
      case 'product':
        title = 'وصل حديثاً';
        body = 'تشكيلة جديدة من المنتجات وصلت للتو. تفضل بالاطلاع عليها.';
        actionData = { productId: 4567 };
        break;
        
      case 'special_offer':
        title = 'عرض خاص اليوم فقط';
        body = 'خصم 25٪ على جميع المنتجات. استخدم الكود: SPECIAL25';
        actionData = { couponCode: 'SPECIAL25' };
        break;
        
      default:
        title = 'إشعار جديد';
        body = 'شكراً لتفاعلك مع تطبيقنا. نتمنى لك تجربة تسوق ممتعة.';
    }
    
    // Create notification data object
    const notification: NotificationData = {
      id: `demo-${Date.now()}`,
      title,
      body,
      type,
      actionData,
      isRead: false,
      receivedAt: now
    };
    
    // Store the notification using the public method
    this.notificationService.addTestNotification(notification);
    this.presentToast('تم إنشاء إشعار تجريبي');
  }
}