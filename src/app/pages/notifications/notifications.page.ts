import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, ModalController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { NotificationService, NotificationData } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: NotificationData[] = [];
  isLoading = true;
  private notificationSubscription: Subscription;
  
  constructor(
    private notificationService: NotificationService,
    private alertController: AlertController,
    private modalController: ModalController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.loadNotifications();
  }
  
  ngOnDestroy() {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }

  /**
   * Load notifications from service
   */
  loadNotifications() {
    this.isLoading = true;
    this.notificationSubscription = this.notificationService.notifications.subscribe(
      notifications => {
        this.notifications = notifications;
        this.isLoading = false;
      }
    );
  }

  /**
   * View notification details and mark as read
   * @param notification The notification to view
   */
  async viewNotification(notification: NotificationData) {
    // Mark notification as read
    await this.notificationService.markNotificationAsRead(notification.id);
    
    // Handle navigation or action based on notification type
    if (notification.actionId) {
      // If notification has a specific action, handle it
      this.handleNotificationAction(notification);
    } else {
      // Otherwise, just show the notification details
      this.showNotificationDetails(notification);
    }
  }
  
  /**
   * Show notification details in an alert
   * @param notification The notification to show
   */
  async showNotificationDetails(notification: NotificationData) {
    const alert = await this.alertController.create({
      header: notification.title,
      message: notification.body,
      buttons: ['حسناً'],
      cssClass: 'notification-alert'
    });
    
    await alert.present();
  }
  
  /**
   * Handle notification action based on type
   * @param notification The notification to handle
   */
  private handleNotificationAction(notification: NotificationData) {
    // Implementation will depend on your app's needs
    // For now, we'll just show the notification details
    this.showNotificationDetails(notification);
  }

  /**
   * Delete notification after confirmation
   * @param notification The notification to delete
   * @param event The click event (to stop propagation)
   */
  async deleteNotification(notification: NotificationData, event: Event) {
    // Stop event propagation to prevent the item from being clicked
    event.stopPropagation();
    
    const alert = await this.alertController.create({
      header: 'تأكيد الحذف',
      message: 'هل أنت متأكد من رغبتك في حذف هذا الإشعار؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حذف',
          handler: async () => {
            await this.notificationService.deleteNotification(notification.id);
            
            const toast = await this.toastController.create({
              message: 'تم حذف الإشعار بنجاح',
              duration: 2000,
              position: 'bottom',
              color: 'success'
            });
            
            await toast.present();
          }
        }
      ]
    });
    
    await alert.present();
  }

  /**
   * Clear all notifications after confirmation
   */
  async clearAllNotifications() {
    if (this.notifications.length === 0) {
      return;
    }
    
    const alert = await this.alertController.create({
      header: 'تأكيد الحذف',
      message: 'هل أنت متأكد من رغبتك في حذف جميع الإشعارات؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حذف الكل',
          handler: async () => {
            await this.notificationService.clearAllNotifications();
            
            const toast = await this.toastController.create({
              message: 'تم حذف جميع الإشعارات بنجاح',
              duration: 2000,
              position: 'bottom',
              color: 'success'
            });
            
            await toast.present();
          }
        }
      ]
    });
    
    await alert.present();
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    if (this.notifications.length === 0 || !this.notifications.some(n => !n.isRead)) {
      return;
    }
    
    await this.notificationService.markAllNotificationsAsRead();
    
    const toast = await this.toastController.create({
      message: 'تم تعيين جميع الإشعارات كمقروءة',
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    
    await toast.present();
  }

  /**
   * Refresh notifications list
   * @param event The refresh event
   */
  doRefresh(event: any) {
    this.loadNotifications();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
  
  /**
   * Format date for display
   * @param date The date to format
   */
  formatDate(date: Date): string {
    if (!date) return '';
    
    const now = new Date();
    const notificationDate = new Date(date);
    
    // Check if date is today
    if (now.toDateString() === notificationDate.toDateString()) {
      // Format as time only
      return notificationDate.toLocaleTimeString('ar-SA', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      // Format as date and time
      return notificationDate.toLocaleDateString('ar-SA', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
  
  /**
   * Add a test notification (for development only)
   */
  async addTestNotification() {
    try {
      const testNotification: NotificationData = {
        id: `test-${Date.now()}`,
        title: 'إشعار تجريبي',
        body: 'هذا إشعار تجريبي لاختبار وظائف الإشعارات',
        type: 'general',
        isRead: false,
        receivedAt: new Date()
      };
      
      await this.notificationService.addTestNotification(testNotification);
      
      const toast = await this.toastController.create({
        message: 'تم إضافة إشعار تجريبي',
        duration: 2000,
        position: 'bottom'
      });
      
      await toast.present();
    } catch (error) {
      console.error('Error adding test notification:', error);
      
      const errorToast = await this.toastController.create({
        message: 'حدث خطأ أثناء إضافة الإشعار التجريبي',
        duration: 2000,
        position: 'bottom',
        color: 'danger'
      });
      
      await errorToast.present();
    }
  }
}