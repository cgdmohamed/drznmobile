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
   * Check if there are any notifications
   */
  hasNotifications(): boolean {
    return this.notifications && this.notifications.length > 0;
  }
  
  /**
   * Check if there are any unread notifications
   */
  hasUnreadNotifications(): boolean {
    return this.hasNotifications() && this.notifications.some(n => !n.isRead);
  }

  /**
   * View notification details and mark as read
   * @param notification The notification to view
   */
  async viewNotification(notification: NotificationData) {
    try {
      console.log('Viewing notification:', notification);
      
      if (!notification || !notification.id) {
        console.error('Invalid notification object:', notification);
        throw new Error('Invalid notification: missing required fields');
      }
      
      // Mark notification as read
      await this.notificationService.markNotificationAsRead(notification.id);
      
      // Handle navigation or action based on notification type
      if (notification.actionId) {
        console.log('Handling notification with actionId:', notification.actionId);
        // If notification has a specific action, handle it
        this.handleNotificationAction(notification);
      } else {
        console.log('Showing notification details (no action)');
        // Otherwise, just show the notification details
        this.showNotificationDetails(notification);
      }
    } catch (error) {
      console.error('Error viewing notification:', error);
      
      const toast = await this.toastController.create({
        message: 'حدث خطأ أثناء عرض الإشعار',
        duration: 2000,
        position: 'bottom',
        color: 'danger'
      });
      
      await toast.present();
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
    try {
      console.log('Handling notification action for type:', notification.type);
      
      if (!notification) {
        console.error('Invalid notification object in handleNotificationAction');
        return;
      }
      
      // Implementation will depend on your app's needs
      switch (notification.type) {
        case 'product':
          console.log('Handling product notification with data:', notification.actionData);
          // Navigate to product detail page if actionData contains productId
          // this.router.navigate(['/product', notification.actionData?.productId]);
          break;
          
        case 'order':
          console.log('Handling order notification with data:', notification.actionData);
          // Navigate to order detail page if actionData contains orderId
          // this.router.navigate(['/order', notification.actionData?.orderId]);
          break;
          
        case 'url':
          console.log('Handling URL notification with data:', notification.actionData);
          // Open URL in browser if actionData contains url
          if (notification.actionData?.url) {
            window.open(notification.actionData.url, '_blank');
          }
          break;
          
        default:
          console.log('No specific action for notification type:', notification.type);
          // Default is to show notification details
          this.showNotificationDetails(notification);
          break;
      }
    } catch (error) {
      console.error('Error handling notification action:', error);
      // Default is to show notification details
      this.showNotificationDetails(notification);
    }
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
  formatDate(date: any): string {
    if (!date) return '';
    
    try {
      console.log('Formatting date:', date);
      const now = new Date();
      const notificationDate = new Date(date);
      
      if (isNaN(notificationDate.getTime())) {
        console.error('Invalid date format:', date);
        return '';
      }
      
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
          day: 'numeric'
        }) + ' ' + notificationDate.toLocaleTimeString('ar-SA', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return '';
    }
  }
  
  /**
   * Add a test notification (for development only)
   */
  async addTestNotification() {
    try {
      console.log('Adding test notification');
      // Create a test notification with all required fields
      const testNotification = {
        id: `test-${Date.now()}`,
        title: 'إشعار تجريبي',
        body: 'هذا إشعار تجريبي لاختبار وظائف الإشعارات',
        type: 'general',
        isRead: false,
        receivedAt: new Date()
      };
      
      console.log('Test notification payload:', testNotification);
      
      // Pass the fully formed notification to the service
      await this.notificationService.addTestNotification(testNotification);
      
      // Refresh the notifications list to show the new notification
      this.loadNotifications();
      
      const toast = await this.toastController.create({
        message: 'تم إضافة إشعار تجريبي',
        duration: 2000,
        position: 'bottom'
      });
      
      await toast.present();
    } catch (error) {
      console.error('Error adding test notification:', error);
      
      let errorMessage = 'حدث خطأ أثناء إضافة الإشعار التجريبي';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      
      const errorToast = await this.toastController.create({
        message: errorMessage,
        duration: 3000,
        position: 'bottom',
        color: 'danger'
      });
      
      await errorToast.present();
    }
  }
}