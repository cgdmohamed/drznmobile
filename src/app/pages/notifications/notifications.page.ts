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
    this.presentToast('Notification marked as read');
  }

  async markAllAsRead() {
    const alert = await this.alertController.create({
      header: 'Mark All as Read',
      message: 'Are you sure you want to mark all notifications as read?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Mark All',
          handler: async () => {
            await this.notificationService.markAllNotificationsAsRead();
            this.presentToast('All notifications marked as read');
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteNotification(notification: NotificationData) {
    const alert = await this.alertController.create({
      header: 'Delete Notification',
      message: 'Are you sure you want to delete this notification?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: async () => {
            await this.notificationService.deleteNotification(notification.id);
            this.presentToast('Notification deleted');
          }
        }
      ]
    });

    await alert.present();
  }

  async clearAllNotifications() {
    const alert = await this.alertController.create({
      header: 'Clear All Notifications',
      message: 'Are you sure you want to delete all notifications? This cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          handler: async () => {
            await this.notificationService.clearAllNotifications();
            this.presentToast('All notifications cleared');
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
      return diffInMin === 1 ? '1 minute ago' : `${diffInMin} minutes ago`;
    } else if (diffInHours < 24) {
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
    } else if (diffInDays < 7) {
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    } else {
      return receivedDate.toLocaleDateString();
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
}