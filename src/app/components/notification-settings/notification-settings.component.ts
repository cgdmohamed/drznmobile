import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { EnvironmentService } from '../../services/environment.service';
import { Platform } from '@ionic/angular';

declare let OneSignal: any;

@Component({
  selector: 'app-notification-settings',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ 'إشعارات التطبيق' }}</ion-card-title>
        <ion-card-subtitle>{{ 'تحكم بإعدادات الإشعارات في التطبيق' }}</ion-card-subtitle>
      </ion-card-header>

      <ion-card-content>
        <ion-list lines="full">
          <ion-item>
            <ion-label>تفعيل الإشعارات</ion-label>
            <ion-toggle [(ngModel)]="notificationsEnabled" (ionChange)="toggleNotifications($event)"></ion-toggle>
          </ion-item>
          
          <ion-item *ngIf="notificationsEnabled">
            <ion-label>إشعارات الطلبات</ion-label>
            <ion-toggle [(ngModel)]="orderNotificationsEnabled" (ionChange)="updateNotificationCategories()"></ion-toggle>
          </ion-item>
          
          <ion-item *ngIf="notificationsEnabled">
            <ion-label>إشعارات العروض</ion-label>
            <ion-toggle [(ngModel)]="promotionNotificationsEnabled" (ionChange)="updateNotificationCategories()"></ion-toggle>
          </ion-item>
        </ion-list>
        
        <div class="ion-padding">
          <ion-button expand="block" (click)="refreshNotificationToken()" [disabled]="!notificationsEnabled">
            تحديث رمز الإشعارات
          </ion-button>
        </div>
        
        <div *ngIf="playerId" class="ion-text-center ion-padding-top">
          <small>رمز الجهاز: {{ playerId }}</small>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    ion-card {
      margin: 16px;
    }
    ion-toggle {
      --background: #f5f5f5;
      --background-checked: #ec1c24;
      --handle-background: #ffffff;
      --handle-background-checked: #ffffff;
    }
    ion-button {
      --background: #ec1c24;
      --background-activated: #c01920;
      --background-focused: #c01920;
      --background-hover: #d81921;
      --color: white;
    }
  `]
})
export class NotificationSettingsComponent implements OnInit {
  notificationsEnabled = false;
  orderNotificationsEnabled = true;
  promotionNotificationsEnabled = true;
  playerId: string = '';

  constructor(
    private notificationService: NotificationService,
    private environmentService: EnvironmentService,
    private platform: Platform,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    // Load notification settings from storage
    await this.loadSettings();
    
    // Check initial notification permission status
    this.checkNotificationStatus();
  }

  /**
   * Load notification settings from storage
   */
  private async loadSettings() {
    try {
      // Get player ID from notification service
      this.playerId = await this.notificationService.getPlayerId();
      
      // If we have a player ID, notifications are likely enabled
      this.notificationsEnabled = !!this.playerId;
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }

  /**
   * Check OneSignal notification permission status
   */
  private async checkNotificationStatus() {
    // Only proceed if on a mobile device with OneSignal
    if (!this.isOneSignalAvailable() || !this.isOnDevice()) {
      console.log('OneSignal not available or not on device');
      return;
    }

    try {
      // Get current notification permission state
      const deviceState = await OneSignal.getDeviceState();
      
      if (deviceState) {
        this.notificationsEnabled = deviceState.hasNotificationPermission && deviceState.isSubscribed;
        this.playerId = deviceState.userId || '';
        
        console.log('OneSignal device state:', {
          permission: deviceState.hasNotificationPermission,
          subscribed: deviceState.isSubscribed,
          playerId: this.playerId
        });
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  }

  /**
   * Toggle notification subscription
   */
  async toggleNotifications(event: any) {
    const enabled = event.detail.checked;
    
    // Only proceed if on a mobile device with OneSignal
    if (!this.isOneSignalAvailable() || !this.isOnDevice()) {
      await this.showDevModeAlert();
      // Revert toggle if not in proper environment
      this.notificationsEnabled = false;
      return;
    }
    
    if (enabled) {
      await this.enableNotifications();
    } else {
      await this.disableNotifications();
    }
  }

  /**
   * Enable push notifications
   */
  private async enableNotifications() {
    const loading = await this.loadingController.create({
      message: 'جاري تفعيل الإشعارات...',
      duration: 3000
    });
    await loading.present();
    
    try {
      // Prompt for push notification permission
      await OneSignal.promptForPushNotificationsWithUserResponse(true);
      
      // Get updated device state
      const deviceState = await OneSignal.getDeviceState();
      
      if (deviceState) {
        this.notificationsEnabled = deviceState.hasNotificationPermission && deviceState.isSubscribed;
        this.playerId = deviceState.userId || '';
        
        if (this.notificationsEnabled) {
          await this.presentToast('تم تفعيل الإشعارات بنجاح');
          // Update category preferences
          this.updateNotificationCategories();
        } else {
          await this.presentToast('لم يتم منح إذن الإشعارات', 'warning');
          this.notificationsEnabled = false;
        }
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      await this.presentToast('حدث خطأ أثناء تفعيل الإشعارات', 'danger');
      this.notificationsEnabled = false;
    } finally {
      loading.dismiss();
    }
  }

  /**
   * Disable push notifications
   */
  private async disableNotifications() {
    const loading = await this.loadingController.create({
      message: 'جاري إلغاء تفعيل الإشعارات...',
      duration: 3000
    });
    await loading.present();
    
    try {
      // Unsubscribe from push notifications
      await OneSignal.setSubscription(false);
      await this.presentToast('تم إلغاء تفعيل الإشعارات');
    } catch (error) {
      console.error('Error disabling notifications:', error);
      await this.presentToast('حدث خطأ أثناء إلغاء تفعيل الإشعارات', 'danger');
      // Revert toggle state
      this.notificationsEnabled = true;
    } finally {
      loading.dismiss();
    }
  }

  /**
   * Update notification categories
   */
  async updateNotificationCategories() {
    if (!this.isOneSignalAvailable() || !this.isOnDevice() || !this.notificationsEnabled) {
      return;
    }
    
    try {
      const categories = [];
      
      if (this.orderNotificationsEnabled) {
        categories.push('order');
      }
      
      if (this.promotionNotificationsEnabled) {
        categories.push('promotion');
      }
      
      // Set user tags to filter notifications
      await OneSignal.sendTags({
        order_notifications: this.orderNotificationsEnabled ? 'enabled' : 'disabled',
        promotion_notifications: this.promotionNotificationsEnabled ? 'enabled' : 'disabled'
      });
      
      console.log('Updated notification categories:', categories);
    } catch (error) {
      console.error('Error updating notification categories:', error);
    }
  }

  /**
   * Refresh notification token
   */
  async refreshNotificationToken() {
    if (!this.isOneSignalAvailable() || !this.isOnDevice()) {
      await this.showDevModeAlert();
      return;
    }
    
    const loading = await this.loadingController.create({
      message: 'جاري تحديث رمز الإشعارات...',
      duration: 3000
    });
    await loading.present();
    
    try {
      // Set subscription to false then true to refresh the token
      await OneSignal.setSubscription(false);
      setTimeout(async () => {
        await OneSignal.setSubscription(true);
        
        // Get updated device state
        const deviceState = await OneSignal.getDeviceState();
        
        if (deviceState && deviceState.userId) {
          this.playerId = deviceState.userId;
          await this.presentToast('تم تحديث رمز الإشعارات بنجاح');
        } else {
          await this.presentToast('لم يتم تحديث رمز الإشعارات', 'warning');
        }
        
        loading.dismiss();
      }, 1000);
    } catch (error) {
      console.error('Error refreshing notification token:', error);
      await this.presentToast('حدث خطأ أثناء تحديث رمز الإشعارات', 'danger');
      loading.dismiss();
    }
  }

  /**
   * Show toast message
   */
  private async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  /**
   * Show developer mode alert
   */
  private async showDevModeAlert() {
    const alert = await this.alertController.create({
      header: 'وضع التطوير',
      message: 'هذه الخاصية متاحة فقط على الأجهزة الحقيقية.',
      buttons: ['حسناً']
    });
    await alert.present();
  }

  /**
   * Check if OneSignal is available
   */
  private isOneSignalAvailable(): boolean {
    return typeof OneSignal !== 'undefined' && this.environmentService.isOneSignalConfigured();
  }

  /**
   * Check if running on a real device
   */
  private isOnDevice(): boolean {
    return this.platform.is('capacitor') || this.platform.is('cordova');
  }
}