import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Platform, NavController, ToastController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { EnvironmentService } from './environment.service';
import { BehaviorSubject, Observable } from 'rxjs';

declare let OneSignal: any;

/**
 * Notification data interface
 */
export interface NotificationData {
  id: string;
  title: string;
  body: string;
  additionalData?: any;
  type?: string;
  actionId?: string;
  actionData?: any;
  isRead?: boolean;
  receivedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private playerId: string = '';
  private _notifications = new BehaviorSubject<NotificationData[]>([]);
  private readonly NOTIFICATIONS_STORAGE_KEY = 'user_notifications';
  private readonly PLAYER_ID_STORAGE_KEY = 'onesignal_player_id';
  private _notificationCount = new BehaviorSubject<number>(0);

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private platform: Platform,
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private router: Router,
    private navController: NavController,
    private toastController: ToastController
  ) {}

  /**
   * Initialize push notifications when app starts
   */
  async initPushNotifications() {
    // Initialize notifications list from storage
    await this.loadNotificationsFromStorage();
    
    // Skip OneSignal initialization if not on a device or OneSignal not configured
    if (!(this.platform.is('capacitor') || this.platform.is('cordova'))) {
      console.log('Push notifications not available in browser environment');
      return;
    }
    
    if (!this.environmentService.isOneSignalConfigured()) {
      console.warn('OneSignal App ID not configured');
      return;
    }
    
    // Load saved player ID if available
    const savedPlayerId = await this.storage.get(this.PLAYER_ID_STORAGE_KEY);
    if (savedPlayerId) {
      this.playerId = savedPlayerId;
    }
    
    // Initialize OneSignal
    this.oneSignalInit();
  }

  /**
   * Get notifications as an observable
   */
  get notifications(): Observable<NotificationData[]> {
    return this._notifications.asObservable();
  }
  
  /**
   * Get unread notification count
   */
  get unreadCount(): Observable<number> {
    return this._notificationCount.asObservable();
  }
  
  /**
   * Get current notification count
   */
  getCurrentUnreadCount(): number {
    return this._notifications.value.filter(n => !n.isRead).length;
  }

  /**
   * Initialize OneSignal SDK
   */
  private oneSignalInit() {
    if (typeof OneSignal === 'undefined') {
      console.warn('OneSignal SDK is not available');
      return;
    }
    
    try {
      // Initialize OneSignal SDK
      OneSignal.init({
        appId: this.environmentService.oneSignalAppId,
        notifyButton: {
          enable: false
        },
        allowLocalhostAsSecureOrigin: true, // For testing in development
      });
      
      // Prompt for notification permission
      OneSignal.promptForPushNotificationsWithUserResponse(function(accepted: boolean) {
        console.log("User accepted notifications: " + accepted);
      });
      
      // Set up notification event handlers
      this.setupNotificationHandlers();
      
      // Get device state and save player ID
      this.getDeviceState();
    } catch (error) {
      console.error('Error initializing OneSignal:', error);
    }
  }
  
  /**
   * Set up OneSignal notification handlers
   */
  private setupNotificationHandlers() {
    // When notification received while app is open
    OneSignal.on('notificationDisplay', (event: any) => {
      console.log('Notification received in-app:', event);
      this.storeNotification(this.parseNotificationData(event));
      this.updateNotificationCount();
      this.showNotificationToast(event.title, event.body);
    });
    
    // When notification is tapped by user
    OneSignal.on('notificationOpen', (openedEvent: any) => {
      console.log('Notification opened:', openedEvent);
      
      const notificationData = this.parseNotificationData(openedEvent.notification);
      
      // Store the notification if not already stored
      this.storeNotification(notificationData);
      
      // Handle notification action/navigation
      this.handleNotificationAction(notificationData);
    });
    
    // When notification permissions change
    OneSignal.on('permissionChange', (permissionChange: boolean) => {
      console.log('Notification permission changed:', permissionChange);
    });
  }
  
  /**
   * Get OneSignal device state and update player ID
   */
  private async getDeviceState() {
    try {
      const deviceState = await OneSignal.getDeviceState();
      console.log('OneSignal Device State:', deviceState);
      
      if (deviceState && deviceState.userId && deviceState.userId !== this.playerId) {
        this.savePlayerId(deviceState.userId);
      }
    } catch (error) {
      console.error('Error getting OneSignal device state:', error);
    }
  }

  /**
   * Save player ID to storage and register with server
   * @param id OneSignal Player ID
   */
  private async savePlayerId(id: string) {
    this.playerId = id;
    await this.storage.set(this.PLAYER_ID_STORAGE_KEY, id);
    
    // Register device for logged in user
    const userId = this.authService.userValue?.id;
    if (userId) {
      this.registerDeviceForUser(userId, id);
    }
  }

  /**
   * Register device for user with server
   * @param userId User ID
   * @param deviceId OneSignal Device ID
   */
  registerDeviceForUser(userId: number | undefined, deviceId: string) {
    if (!userId) return;
    
    const registerEndpoint = '/wp-json/darzn/v1/devices';
    
    // In a real implementation, this would send to your server
    const deviceData = {
      user_id: userId,
      player_id: deviceId,
      platform: this.platform.is('ios') ? 'ios' : 'android',
      status: 'active'
    };
    
    // For demo, we'll just log it
    console.log(`Registering device ${deviceId} for user ${userId}`, deviceData);
    
    // In production, we would call the API endpoint
    // return this.http.post(registerEndpoint, deviceData);
  }

  /**
   * Unregister device when user logs out
   */
  async unregisterDevice() {
    if (!this.playerId) return;
    
    // Log for demo
    console.log(`Unregistering device ${this.playerId}`);
    
    // In production, call the API to deactivate the device
    // const deactivateEndpoint = `/wp-json/darzn/v1/devices/${this.playerId}`;
    // this.http.put(deactivateEndpoint, { status: 'inactive' });
    
    // Clear player ID from storage
    this.playerId = '';
    await this.storage.remove(this.PLAYER_ID_STORAGE_KEY);
    
    // If on a real device, try to remove all notifications and unsubscribe
    if (typeof OneSignal !== 'undefined') {
      try {
        // Clear notifications
        OneSignal.clearOneSignalNotifications();
        
        // Unsubscribe user
        const deviceState = await OneSignal.getDeviceState();
        if (deviceState && deviceState.isSubscribed) {
          OneSignal.setSubscription(false);
        }
      } catch (error) {
        console.error('Error unregistering device:', error);
      }
    }
  }
  
  /**
   * Parse notification data into standardized format
   * @param notification Raw notification data
   */
  private parseNotificationData(notification: any): NotificationData {
    // Extract additional data from notification
    const additionalData = notification.additionalData || {};
    
    // Create standardized notification object
    return {
      id: notification.notificationId || `local-${Date.now()}`,
      title: notification.title || 'New Notification',
      body: notification.body || notification.message || '',
      additionalData: additionalData,
      type: additionalData.type || 'general',
      actionId: additionalData.actionId || additionalData.action_id,
      actionData: additionalData.actionData || additionalData.action_data,
      isRead: false,
      receivedAt: new Date()
    };
  }
  
  /**
   * Store notification in local storage
   * @param notification Notification data to store
   */
  private async storeNotification(notification: NotificationData) {
    try {
      console.log('Storing notification:', notification);
      
      if (!notification || !notification.id) {
        console.error('Invalid notification object:', notification);
        throw new Error('Invalid notification: missing required fields');
      }
      
      // Get current notifications
      const currentNotifications = this._notifications.value;
      
      // Check if notification already exists
      const existingIndex = currentNotifications.findIndex(n => n.id === notification.id);
      
      if (existingIndex >= 0) {
        console.log('Updating existing notification at index:', existingIndex);
        // Update existing notification
        currentNotifications[existingIndex] = {
          ...currentNotifications[existingIndex],
          ...notification,
          // Keep isRead status if already read
          isRead: currentNotifications[existingIndex].isRead || notification.isRead
        };
      } else {
        console.log('Adding new notification');
        // Add new notification
        currentNotifications.unshift(notification);
      }
      
      // Update observable and storage
      this._notifications.next(currentNotifications);
      await this.saveNotificationsToStorage();
      this.updateNotificationCount();
      console.log('Notification stored successfully');
    } catch (error) {
      console.error('Error storing notification:', error);
      throw error;
    }
  }
  
  /**
   * Mark notification as read
   * @param notificationId ID of notification to mark as read
   */
  async markNotificationAsRead(notificationId: string) {
    const notifications = this._notifications.value;
    const notificationIndex = notifications.findIndex(n => n.id === notificationId);
    
    if (notificationIndex >= 0) {
      notifications[notificationIndex].isRead = true;
      this._notifications.next(notifications);
      await this.saveNotificationsToStorage();
      this.updateNotificationCount();
    }
  }
  
  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead() {
    const notifications = this._notifications.value.map(n => ({...n, isRead: true}));
    this._notifications.next(notifications);
    await this.saveNotificationsToStorage();
    this.updateNotificationCount();
  }
  
  /**
   * Delete a notification
   * @param notificationId ID of notification to delete
   */
  async deleteNotification(notificationId: string) {
    const notifications = this._notifications.value.filter(n => n.id !== notificationId);
    this._notifications.next(notifications);
    await this.saveNotificationsToStorage();
    this.updateNotificationCount();
  }
  
  /**
   * Delete all notifications
   */
  async clearAllNotifications() {
    this._notifications.next([]);
    await this.saveNotificationsToStorage();
    this.updateNotificationCount();
  }
  
  /**
   * Add a test notification (for development/demo purposes)
   * @param notification The notification data to add (optional)
   */
  async addTestNotification(notification?: NotificationData) {
    try {
      // If no notification is provided, create a default test notification
      if (!notification) {
        notification = {
          id: `test-${Date.now()}`,
          title: 'إشعار تجريبي',
          body: 'هذا إشعار تجريبي لاختبار وظائف الإشعارات',
          type: 'general',
          isRead: false,
          receivedAt: new Date()
        };
      }
      
      // Store the notification
      await this.storeNotification(notification);
      return notification;
    } catch (error) {
      console.error('Error adding test notification:', error);
      throw error;
    }
  }
  
  /**
   * Update notification count
   */
  private updateNotificationCount() {
    const unreadCount = this._notifications.value.filter(n => !n.isRead).length;
    this._notificationCount.next(unreadCount);
  }
  
  /**
   * Save notifications to storage
   */
  private async saveNotificationsToStorage() {
    try {
      console.log('Saving notifications to storage');
      await this.storage.set(this.NOTIFICATIONS_STORAGE_KEY, this._notifications.value);
      console.log('Notifications saved successfully');
    } catch (error) {
      console.error('Error saving notifications to storage:', error);
      throw error;
    }
  }
  
  /**
   * Load notifications from storage
   */
  private async loadNotificationsFromStorage() {
    try {
      console.log('Loading notifications from storage');
      const savedNotifications = await this.storage.get(this.NOTIFICATIONS_STORAGE_KEY);
      console.log('Loaded notifications:', savedNotifications ? savedNotifications.length : 0);
      
      if (savedNotifications) {
        this._notifications.next(savedNotifications);
        this.updateNotificationCount();
      } else {
        console.log('No saved notifications found');
        // Initialize with empty array to ensure the BehaviorSubject has a valid value
        this._notifications.next([]);
      }
    } catch (error) {
      console.error('Error loading notifications from storage:', error);
      // Set empty array as fallback
      this._notifications.next([]);
      this.updateNotificationCount();
    }
  }
  
  /**
   * Handle notification action (navigation)
   * @param notification The notification data
   */
  private handleNotificationAction(notification: NotificationData) {
    // Default is to mark as read
    this.markNotificationAsRead(notification.id);
    
    // Handle different notification types
    switch(notification.type) {
      case 'order':
        if (notification.actionData?.orderId) {
          this.navController.navigateForward(`/order/${notification.actionData.orderId}`);
        }
        break;
        
      case 'product':
        if (notification.actionData?.productId) {
          this.navController.navigateForward(`/product/${notification.actionData.productId}`);
        }
        break;
        
      case 'category':
        if (notification.actionData?.categoryId) {
          this.navController.navigateForward(`/category/${notification.actionData.categoryId}`);
        }
        break;
        
      case 'url':
        if (notification.actionData?.url) {
          window.open(notification.actionData.url, '_blank');
        }
        break;
        
      case 'special_offer':
        this.navController.navigateForward('/special-offers');
        break;
        
      default:
        // Navigate to notifications screen
        this.navController.navigateForward('/notifications');
        break;
    }
  }
  
  /**
   * Show notification toast
   * @param title Notification title
   * @param message Notification message
   */
  private async showNotificationToast(title: string, message: string) {
    const toast = await this.toastController.create({
      header: title,
      message: message,
      position: 'top',
      duration: 3000,
      buttons: [
        {
          text: 'View',
          role: 'info',
          handler: () => {
            this.navController.navigateForward('/notifications');
          }
        },
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }
}