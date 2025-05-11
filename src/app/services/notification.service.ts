import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Platform, NavController, ToastController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { EnvironmentService } from './environment.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  OneSignalDevice, 
  OneSignalNotification, 
  OneSignalOpenedNotification 
} from '../interfaces/onesignal.interface';

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
   * Navigate to the notifications page
   * This method provides a central place to handle navigation to the notifications page
   */
  navigateToNotificationsPage() {
    console.log('Notification service: navigating to notifications page');
    try {
      // Use the NavController for a more consistent navigation experience
      this.navController.navigateForward('/notifications');
      console.log('Notification service: navigation command executed');
    } catch (error) {
      console.error('Notification service: Error navigating to notifications page:', error);
      
      // Fallback to basic router navigation if NavController fails
      try {
        console.log('Notification service: trying fallback router navigation');
        this.router.navigateByUrl('/notifications');
      } catch (routerError) {
        console.error('Notification service: Router fallback navigation also failed:', routerError);
      }
    }
  }

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
   * Check if OneSignal is available and initialized
   */
  isOneSignalAvailable(): boolean {
    return (this.platform.is('capacitor') || this.platform.is('cordova')) && 
           typeof OneSignal !== 'undefined' &&
           this.environmentService.isOneSignalConfigured();
  }
  
  /**
   * Show a local notification on the device
   * This simulates a push notification for testing purposes
   */
  async showLocalNotification(title: string, message: string, data?: any): Promise<void> {
    // On a real device with OneSignal
    if (this.isOneSignalAvailable()) {
      try {
        console.log('Showing local notification via OneSignal');
        await OneSignal.postNotification({
          title: title,
          body: message,
          data: data || {}
        });
        return;
      } catch (error) {
        console.error('Error showing OneSignal notification:', error);
        // Fall back to toast notification
      }
    }
    
    // Fall back to a toast notification if OneSignal is not available
    console.log('Showing notification via toast (simulation)');
    await this.showNotificationToast(title, message);
    
    // Also store the notification in our local system
    const notificationData: NotificationData = {
      id: Date.now().toString(),
      title: title,
      body: message,
      additionalData: data,
      isRead: false,
      receivedAt: new Date()
    };
    
    this.storeNotification(notificationData);
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
   * Get the current OneSignal player ID
   * @returns Promise that resolves to the current player ID or empty string
   */
  async getPlayerId(): Promise<string> {
    // If we already have a player ID, return it
    if (this.playerId) {
      return this.playerId;
    }
    
    // Try to get it from storage
    try {
      const savedId = await this.storage.get(this.PLAYER_ID_STORAGE_KEY);
      if (savedId) {
        this.playerId = savedId;
        return savedId;
      }
    } catch (error) {
      console.error('Error retrieving player ID from storage:', error);
    }
    
    // If we're on a device, try to get it from OneSignal
    if ((this.platform.is('capacitor') || this.platform.is('cordova')) && 
        typeof OneSignal !== 'undefined') {
      try {
        const deviceState = await OneSignal.getDeviceState();
        if (deviceState && deviceState.userId) {
          this.playerId = deviceState.userId;
          return deviceState.userId;
        }
      } catch (error) {
        console.error('Error getting player ID from OneSignal:', error);
      }
    }
    
    // Return empty string if no player ID is found
    return '';
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
      console.log('Initializing OneSignal with App ID:', this.environmentService.oneSignalAppId);
      
      // Initialize OneSignal SDK with updated options
      OneSignal.init({
        appId: this.environmentService.oneSignalAppId,
        notifyButton: {
          enable: false // We'll handle this through our own UI
        },
        allowLocalhostAsSecureOrigin: true, // For testing in development
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push", // current types are "push" & "category"
                autoPrompt: true,
                text: {
                  actionMessage: "نود إرسال إشعارات لك عن الطلبات والعروض الخاصة.",
                  acceptButton: "السماح",
                  cancelButton: "لا، شكراً"
                },
                delay: {
                  timeDelay: 10,
                  pageViews: 2
                }
              }
            ]
          }
        }
      });
      
      // Log initialization success
      console.log('OneSignal initialized successfully');
      
      // Handle user permission response
      OneSignal.promptForPushNotificationsWithUserResponse((accepted: boolean) => {
        console.log("User accepted notifications: " + accepted);
        if (accepted) {
          console.log('User has accepted notifications, getting device state');
          this.getDeviceState();
        }
      });
      
      // Set up notification event handlers
      this.setupNotificationHandlers();
      
      // Get device state and save player ID even if not prompted yet
      this.getDeviceState();
    } catch (error) {
      console.error('Error initializing OneSignal:', error);
      // Fallback to simpler initialization if needed
      try {
        console.log('Trying fallback OneSignal initialization');
        OneSignal.init(this.environmentService.oneSignalAppId);
        this.setupNotificationHandlers();
        this.getDeviceState();
      } catch (fallbackError) {
        console.error('Fallback OneSignal initialization also failed:', fallbackError);
      }
    }
  }
  
  /**
   * Set up OneSignal notification handlers
   */
  private setupNotificationHandlers() {
    console.log('Setting up OneSignal notification handlers');
    
    // When notification received while app is open (foreground notification)
    OneSignal.on('notificationDisplay', (event: OneSignalNotification) => {
      console.log('Notification received in-app (foreground):', event);
      try {
        // Parse and store the notification
        const notificationData = this.parseNotificationData(event);
        this.storeNotification(notificationData);
        this.updateNotificationCount();
        
        // Show toast notification to the user
        this.showNotificationToast(
          event.title || 'New Notification', 
          event.body || 'You have received a new notification'
        );
      } catch (error) {
        console.error('Error handling foreground notification:', error);
      }
    });
    
    // When notification is tapped by user (opened from notification center)
    OneSignal.on('notificationOpen', (openedEvent: OneSignalOpenedNotification) => {
      console.log('Notification opened by user:', openedEvent);
      
      try {
        // Parse and get the notification data
        const notificationData = this.parseNotificationData(openedEvent.notification);
        
        // Store the notification if not already stored
        this.storeNotification(notificationData);
        
        // Handle notification action/navigation
        this.handleNotificationAction(notificationData);
      } catch (error) {
        console.error('Error handling opened notification:', error);
      }
    });
    
    // When notification permissions change
    OneSignal.on('permissionChange', (permissionChange: boolean) => {
      console.log('Notification permission changed:', permissionChange);
      
      if (permissionChange) {
        // Permission granted, can register device with backend
        this.getDeviceState();
      }
    });
    
    // Add error handler to log any OneSignal errors
    OneSignal.on('error', (error: any) => {
      console.error('OneSignal error occurred:', error);
    });
    
    console.log('OneSignal notification handlers set up successfully');
  }
  
  /**
   * Get OneSignal device state and update player ID
   */
  private async getDeviceState() {
    if (typeof OneSignal === 'undefined') {
      console.warn('Cannot get device state: OneSignal is not defined');
      return;
    }
    
    try {
      console.log('Getting OneSignal device state...');
      const deviceState: OneSignalDevice = await OneSignal.getDeviceState();
      console.log('OneSignal Device State:', deviceState);
      
      if (deviceState) {
        // Display device state for debugging
        console.log(`OneSignal Device Details:
          - Player ID: ${deviceState.userId || 'Not set'}
          - Push Token: ${deviceState.pushToken ? 'Set' : 'Not set'}
          - Subscribed: ${deviceState.isSubscribed}
          - Push Disabled: ${deviceState.isPushDisabled}
          - Has Permission: ${deviceState.hasNotificationPermission}
        `);
        
        // Save Player ID if it exists and is different from current
        if (deviceState.userId && deviceState.userId !== this.playerId) {
          console.log(`Saving new player ID: ${deviceState.userId}`);
          await this.savePlayerId(deviceState.userId);
        } else if (!deviceState.userId) {
          console.warn('No OneSignal player ID available yet');
        }
        
        // If user denied permission, log it
        if (!deviceState.hasNotificationPermission) {
          console.warn('User has denied notification permission');
        }
      } else {
        console.warn('No OneSignal device state available');
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
    if (!id) {
      console.error('Cannot save empty player ID');
      return;
    }
    
    try {
      console.log(`Saving player ID: ${id}`);
      
      // Update local playerId
      this.playerId = id;
      
      // Save to storage
      await this.storage.set(this.PLAYER_ID_STORAGE_KEY, id);
      console.log('Player ID saved to storage');
      
      // Register device for logged in user
      const userId = this.authService.userValue?.id;
      if (userId) {
        console.log(`Registering device for user ID: ${userId}`);
        this.registerDeviceForUser(userId, id);
      } else {
        console.log('No user ID available, skipping device registration with backend');
      }
    } catch (error) {
      console.error('Error saving player ID:', error);
    }
  }

  /**
   * Register device for user with server
   * @param userId User ID
   * @param deviceId OneSignal Device ID
   * @returns Observable of the registration HTTP request
   */
  registerDeviceForUser(userId: number | undefined, deviceId: string) {
    if (!userId || !deviceId) {
      console.error('Cannot register device: Missing user ID or device ID');
      return;
    }
    
    console.log(`Registering device ${deviceId} for user ${userId}`);
    
    // Determine platform
    let platform = 'web';
    if (this.platform.is('ios')) {
      platform = 'ios';
    } else if (this.platform.is('android')) {
      platform = 'android';
    }
    
    // Prepare device data
    const deviceData = {
      user_id: userId,
      player_id: deviceId,
      platform: platform,
      status: 'active',
      app_version: '1.0', // Should be dynamically determined in a real app
      device_model: this.platform.is('mobileweb') ? 'Web Browser' : navigator.userAgent
    };
    
    // Get API URL based on platform
    const baseUrl = this.environmentService.getBaseUrl();
    const registerEndpoint = `${baseUrl}/wp-json/darzn/v1/devices`;
    
    // Log what we would send
    console.log(`Would register device with endpoint: ${registerEndpoint}`, deviceData);
    
    // Uncomment the following line to enable actual API call in production
    // return this.http.post(registerEndpoint, deviceData);
    
    // TODO: Enable the actual API call when the backend is ready
    // For now, we'll just simulate a successful registration in dev mode
    return Promise.resolve({ success: true, message: 'Device registered successfully (simulated)' });
  }

  /**
   * Unregister device when user logs out
   */
  async unregisterDevice() {
    if (!this.playerId) {
      console.log('No player ID to unregister');
      return;
    }
    
    console.log(`Unregistering device ${this.playerId}`);
    
    // Get API URL based on platform
    const baseUrl = this.environmentService.getBaseUrl();
    const deactivateEndpoint = `${baseUrl}/wp-json/darzn/v1/devices/${this.playerId}`;
    
    // Log what we would send
    console.log(`Would deactivate device with endpoint: ${deactivateEndpoint}`);
    
    // Uncomment the following line to enable actual API call in production
    // await this.http.put(deactivateEndpoint, { status: 'inactive' }).toPromise();
    
    // Clear OneSignal notifications and unsubscribe if possible
    if (typeof OneSignal !== 'undefined') {
      try {
        console.log('Clearing OneSignal notifications');
        
        // Remove all visible notifications
        OneSignal.clearOneSignalNotifications();
        
        // Get the current device state
        const deviceState = await OneSignal.getDeviceState();
        
        // If subscribed, unsubscribe
        if (deviceState && deviceState.isSubscribed) {
          console.log('Unsubscribing from push notifications');
          OneSignal.setSubscription(false);
        }
        
        // Optionally, disable all future notifications
        // WARNING: This will prevent future re-subscription without reinstalling the app
        // OneSignal.disablePush(true);
      } catch (error) {
        console.error('Error clearing OneSignal notifications:', error);
      }
    }
    
    // Clear player ID from storage
    try {
      this.playerId = '';
      await this.storage.remove(this.PLAYER_ID_STORAGE_KEY);
      console.log('Player ID removed from storage');
    } catch (storageError) {
      console.error('Error removing player ID from storage:', storageError);
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
   * @returns Promise that resolves when notification is stored
   */
  async storeNotification(notification: NotificationData): Promise<void> {
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