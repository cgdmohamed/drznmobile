import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ComponentsModule } from '../../components/components.module';
import { NotificationSettingsComponent } from '../../components/notification-settings/notification-settings.component';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { NotificationService } from '../../services/notification.service';

// Define OneSignal globally for TypeScript
declare global {
  interface Window {
    OneSignal?: any;
  }
}

// Use window.OneSignal instead of directly using OneSignal
const OneSignal = typeof window !== 'undefined' ? window.OneSignal : undefined;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule, ComponentsModule],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/account"></ion-back-button>
        </ion-buttons>
        <ion-title>الإعدادات</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content>
      <div class="ion-padding">
        <h2>إعدادات التطبيق</h2>
        
        <!-- User Info Section -->
        <ion-card *ngIf="isLoggedIn">
          <ion-card-header>
            <ion-card-title>معلومات المستخدم</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item lines="none">
              <ion-label>
                <h2>{{ userData?.display_name || 'المستخدم' }}</h2>
                <p>{{ userData?.email || 'لا يوجد بريد إلكتروني' }}</p>
              </ion-label>
            </ion-item>
          </ion-card-content>
        </ion-card>
        
        <!-- Notification Settings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>إشعارات التطبيق</ion-card-title>
            <ion-card-subtitle>تحكم بإعدادات الإشعارات في التطبيق</ion-card-subtitle>
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
        
        <!-- App Settings -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>إعدادات عامة</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="full">
              <ion-item>
                <ion-label>الوضع الليلي</ion-label>
                <ion-toggle [(ngModel)]="darkMode" (ionChange)="toggleDarkMode()"></ion-toggle>
              </ion-item>
              
              <ion-item>
                <ion-label>حفظ البيانات</ion-label>
                <ion-toggle [(ngModel)]="dataSaving" (ionChange)="toggleDataSaving()"></ion-toggle>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>
        
        <!-- App Info -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>معلومات التطبيق</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item lines="none">
              <ion-label>
                <h2>إصدار التطبيق</h2>
                <p>1.0.0</p>
              </ion-label>
            </ion-item>
          </ion-card-content>
        </ion-card>
        
        <!-- Logout Button (only if logged in) -->
        <div class="ion-padding" *ngIf="isLoggedIn">
          <ion-button expand="block" color="danger" (click)="logout()">
            تسجيل الخروج
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    h2 {
      margin: 20px 0;
      font-weight: 600;
      color: var(--ion-color-dark);
    }
    ion-card {
      border-radius: 8px;
      margin-bottom: 20px;
    }
    ion-button {
      margin-top: 16px;
    }
    ion-toggle {
      --background: #f5f5f5;
      --background-checked: #ec1c24;
      --handle-background: #ffffff;
      --handle-background-checked: #ffffff;
    }
  `]
})
export class SettingsPage implements OnInit {
  isLoggedIn: boolean = false;
  userData: any = null;
  darkMode: boolean = false;
  dataSaving: boolean = false;
  
  // Notification settings
  notificationsEnabled: boolean = false;
  orderNotificationsEnabled: boolean = true;
  promotionNotificationsEnabled: boolean = true;
  playerId: string = '';
  
  constructor(
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private notificationService: NotificationService,
    private alertController: AlertController
  ) {}
  
  async ngOnInit() {
    // Check if user is logged in
    this.isLoggedIn = this.authService.isLoggedIn || this.jwtAuthService.isAuthenticated;
    
    // Get user data if logged in
    if (this.isLoggedIn) {
      if (this.authService.userValue) {
        this.userData = this.authService.userValue;
      } else if (this.jwtAuthService.currentUserValue) {
        this.userData = this.jwtAuthService.currentUserValue;
      }
    }
    
    // Load app settings
    this.loadSettings();
    
    // Load notification settings
    await this.loadNotificationSettings();
  }
  
  /**
   * Load notification settings from service
   */
  private async loadNotificationSettings() {
    try {
      // In development/browser, we can simulate a playerId from localStorage
      let storedPlayerId = localStorage.getItem('simulated_player_id');
      let storedStatus = localStorage.getItem('simulated_notification_status');
      
      if (window.OneSignal) {
        // Get player ID from notification service for real devices
        this.playerId = await this.notificationService.getPlayerId();
      } else if (storedPlayerId && storedStatus === 'enabled') {
        // Use stored simulation values in development
        this.playerId = storedPlayerId;
        this.notificationsEnabled = true;
      } else {
        // Default to disabled with no ID
        this.playerId = '';
        this.notificationsEnabled = false;
      }
      
      // Also load category preferences if available
      const orderPref = localStorage.getItem('order_notifications');
      const promoPref = localStorage.getItem('promotion_notifications');
      
      this.orderNotificationsEnabled = orderPref !== 'disabled';
      this.promotionNotificationsEnabled = promoPref !== 'disabled';
      
      console.log('Loaded notification settings, player ID:', this.playerId);
    } catch (error) {
      console.error('Error loading notification settings:', error);
      // Default to disabled if there's an error
      this.playerId = '';
      this.notificationsEnabled = false;
    }
  }
  
  loadSettings() {
    // Load dark mode setting
    const darkMode = localStorage.getItem('darkMode');
    this.darkMode = darkMode === 'true';
    
    // Load data saving setting
    const dataSaving = localStorage.getItem('dataSaving');
    this.dataSaving = dataSaving === 'true';
  }
  
  toggleDarkMode() {
    // Save setting
    localStorage.setItem('darkMode', this.darkMode.toString());
    
    // Apply dark mode if enabled
    document.body.classList.toggle('dark', this.darkMode);
  }
  
  toggleDataSaving() {
    // Save setting
    localStorage.setItem('dataSaving', this.dataSaving.toString());
    
    // You would implement data saving functionality elsewhere in the app
    console.log('Data saving mode:', this.dataSaving ? 'enabled' : 'disabled');
  }
  
  /**
   * Toggle notification subscription status
   */
  async toggleNotifications(event: any) {
    const enabled = event.detail.checked;
    
    // Only proceed if the user is logged in
    if (!this.isLoggedIn) {
      await this.presentAlert(
        'تسجيل الدخول مطلوب',
        'يرجى تسجيل الدخول لاستخدام ميزة الإشعارات'
      );
      this.notificationsEnabled = false;
      return;
    }
    
    // In browser/development environment, simulate notification status
    if (!window.OneSignal) {
      console.log('OneSignal not available, simulating notification preferences in development environment');
      if (enabled) {
        this.playerId = 'simulated-' + Math.random().toString(36).substring(2, 10);
        this.notificationsEnabled = true;
        
        // Save to localStorage to persist across sessions
        localStorage.setItem('simulated_player_id', this.playerId);
        localStorage.setItem('simulated_notification_status', 'enabled');
        
        await this.presentAlert(
          'وضع المحاكاة',
          'تم تفعيل الإشعارات في وضع المحاكاة. رمز الجهاز المحاكى: ' + this.playerId
        );
      } else {
        this.playerId = '';
        this.notificationsEnabled = false;
        
        // Remove from localStorage
        localStorage.removeItem('simulated_player_id');
        localStorage.setItem('simulated_notification_status', 'disabled');
      }
      return;
    }
    
    try {
      if (enabled) {
        await this.enableNotifications();
      } else {
        await this.disableNotifications();
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      this.notificationsEnabled = !enabled; // Revert toggle state
      await this.presentAlert(
        'خطأ',
        'حدث خطأ أثناء تغيير إعدادات الإشعارات'
      );
    }
  }
  
  /**
   * Enable push notifications
   */
  private async enableNotifications() {
    // This would be implemented with OneSignal SDK on real devices
    console.log('Enabling notifications');
    
    if (window.OneSignal) {
      try {
        // Request permission and enable subscription
        await window.OneSignal.promptForPushNotificationsWithUserResponse(true);
        await window.OneSignal.setSubscription(true);
        
        // Get device state to check if permission was granted
        const deviceState = await window.OneSignal.getDeviceState();
        this.notificationsEnabled = deviceState?.hasNotificationPermission && deviceState?.isSubscribed;
        this.playerId = deviceState?.userId || '';
        
        if (this.notificationsEnabled && this.playerId) {
          console.log('Notifications enabled, player ID:', this.playerId);
          this.updateNotificationCategories();
        } else {
          console.warn('Failed to enable notifications');
          this.notificationsEnabled = false;
        }
      } catch (error) {
        console.error('Error enabling notifications:', error);
        this.notificationsEnabled = false;
        throw error;
      }
    } else {
      // Simulate for web development
      console.log('Simulating enabled notifications for development');
      this.playerId = 'dev-' + Math.random().toString(36).substring(2, 10);
    }
  }
  
  /**
   * Disable push notifications
   */
  private async disableNotifications() {
    console.log('Disabling notifications');
    
    if (window.OneSignal) {
      try {
        // Unsubscribe from push notifications
        await window.OneSignal.setSubscription(false);
        this.notificationsEnabled = false;
      } catch (error) {
        console.error('Error disabling notifications:', error);
        throw error;
      }
    } else {
      // Simulate for web development
      console.log('Simulating disabled notifications for development');
      this.playerId = '';
    }
  }
  
  /**
   * Update notification categories with user preferences
   */
  async updateNotificationCategories() {
    if (!this.notificationsEnabled) {
      return;
    }
    
    console.log('Updating notification categories:',
      {
        orders: this.orderNotificationsEnabled,
        promotions: this.promotionNotificationsEnabled
      }
    );
    
    if (window.OneSignal) {
      try {
        // Set user tags to filter notifications by category
        await window.OneSignal.sendTags({
          order_notifications: this.orderNotificationsEnabled ? 'enabled' : 'disabled',
          promotion_notifications: this.promotionNotificationsEnabled ? 'enabled' : 'disabled'
        });
      } catch (error) {
        console.error('Error updating notification categories:', error);
      }
    } else {
      // For development environment, just log the preferences
      console.log('Development mode: Would have set notification categories to:',
        {
          order_notifications: this.orderNotificationsEnabled ? 'enabled' : 'disabled',
          promotion_notifications: this.promotionNotificationsEnabled ? 'enabled' : 'disabled'
        }
      );
    }
  }
  
  /**
   * Refresh notification token
   */
  async refreshNotificationToken() {
    if (!this.notificationsEnabled) {
      return;
    }
    
    console.log('Refreshing notification token');
    
    if (!window.OneSignal) {
      // For development/browser environment, generate a new simulated ID
      this.playerId = 'simulated-' + Math.random().toString(36).substring(2, 10);
      await this.presentAlert(
        'تم التحديث',
        'تم تحديث رمز الإشعارات في وضع المحاكاة: ' + this.playerId
      );
      return;
    }
    
    try {
      // Set subscription to false then true to refresh the token
      await window.OneSignal.setSubscription(false);
      
      // Wait a moment before resubscribing
      setTimeout(async () => {
        await window.OneSignal.setSubscription(true);
        
        // Get the new device state
        const deviceState = await window.OneSignal.getDeviceState();
        
        if (deviceState && deviceState.userId) {
          this.playerId = deviceState.userId;
          await this.presentAlert(
            'تم التحديث',
            'تم تحديث رمز الإشعارات بنجاح'
          );
        } else {
          await this.presentAlert(
            'فشل التحديث',
            'لم يتم تحديث رمز الإشعارات'
          );
        }
      }, 1000);
    } catch (error) {
      console.error('Error refreshing notification token:', error);
      await this.presentAlert(
        'خطأ',
        'حدث خطأ أثناء تحديث رمز الإشعارات'
      );
    }
  }
  
  /**
   * Present an alert to the user
   */
  private async presentAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['حسناً']
    });
    await alert.present();
  }
  
  async logout() {
    // Unregister notifications if enabled
    if (this.notificationsEnabled) {
      try {
        await this.notificationService.unregisterDevice();
      } catch (error) {
        console.error('Error unregistering device:', error);
      }
    }
    
    // Use whichever auth service the user is logged in with
    if (this.authService.isLoggedIn) {
      await this.authService.logout();
    } else if (this.jwtAuthService.isAuthenticated) {
      await this.jwtAuthService.logout();
    }
    
    // Navigate back to account page
    window.location.href = '/tabs/account';
  }
}