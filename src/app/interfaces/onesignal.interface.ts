/**
 * OneSignal interfaces for better type safety
 */

export interface OneSignalDevice {
  userId: string;      // Player ID
  pushToken: string;   // Push token for the device
  isSubscribed: boolean;
  isPushDisabled: boolean;
  hasNotificationPermission: boolean;
}

export interface OneSignalNotification {
  notificationId: string;
  title: string;
  body: string;
  launchURL?: string;
  additionalData?: {
    [key: string]: any;
    type?: string;
    actionId?: string;
    actionData?: any;
  };
  rawPayload?: any;
}

export interface OneSignalOpenedNotification {
  notification: OneSignalNotification;
  action: {
    type: 'opened' | 'action_taken';
    actionId?: string;
  };
}