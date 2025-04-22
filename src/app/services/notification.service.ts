import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Platform } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

declare let OneSignal: any;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private playerId: string = '';
  private appId = environment.oneSignalAppId;

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private platform: Platform,
    private authService: AuthService
  ) {}

  // Initialize push notifications
  initPushNotifications() {
    if (this.platform.is('capacitor') || this.platform.is('cordova')) {
      this.storage.get('playerId').then(id => {
        if (id) {
          this.playerId = id;
        }
        this.oneSignalInit();
      });
    }
  }

  // Save player ID to storage
  savePlayerId(id: string) {
    this.playerId = id;
    this.storage.set('playerId', id);
    
    // Register device for logged in user
    const userId = this.authService.userValue?.id;
    if (userId) {
      this.registerDeviceForUser(userId, id);
    }
  }

  // Initialize OneSignal
  private oneSignalInit() {
    if (typeof OneSignal === 'undefined') {
      console.warn('OneSignal is not available');
      return;
    }
    
    OneSignal.init({
      appId: this.appId,
      notifyButton: {
        enable: false
      }
    });

    OneSignal.on('notificationOpen', (data: any) => {
      this.handleNotificationOpen(data);
    });

    OneSignal.getDeviceState().then((state: any) => {
      if (state.userId && state.userId !== this.playerId) {
        this.savePlayerId(state.userId);
      }
    });
  }

  // Handle notification open
  private handleNotificationOpen(data: any) {
    console.log('Notification opened', data);
    
    // Handle notification actions here
    if (data.notification && data.notification.additionalData) {
      const additionalData = data.notification.additionalData;
      
      if (additionalData.type === 'order') {
        // Navigate to order details
        // this.router.navigate(['/order', additionalData.orderId]);
      }
    }
  }

  // Register device for user
  registerDeviceForUser(userId: number | undefined, deviceId: string) {
    if (!userId) return;
    
    // In a production app, this would call an API endpoint
    console.log(`Registering device ${deviceId} for user ${userId}`);
  }

  // Unregister device
  unregisterDevice() {
    if (this.playerId) {
      // In a production app, this would call an API endpoint
      console.log(`Unregistering device ${this.playerId}`);
      this.playerId = '';
      this.storage.remove('playerId');
    }
  }
}