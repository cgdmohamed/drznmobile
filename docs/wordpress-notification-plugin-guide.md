# WordPress Plugin Development Guide: App Banner & Push Notification System

## Overview

This document provides comprehensive guidance for developing a WordPress plugin that manages in-app banners and sends push notifications to mobile app users. The plugin will integrate with the DARZN Ionic mobile app and support OneSignal for push notification delivery.

## Technical Requirements

- WordPress 5.8+
- PHP 7.4+
- MySQL 5.7+
- WooCommerce 6.0+ (if integrating with e-commerce features)
- REST API support
- OneSignal account and API key

## Plugin Structure

```
darzn-app-notifications/
├── admin/
│   ├── css/
│   │   └── admin-style.css
│   ├── js/
│   │   └── admin-script.js
│   ├── partials/
│   │   ├── banner-manager.php
│   │   └── notification-manager.php
│   └── class-admin.php
├── includes/
│   ├── class-api.php
│   ├── class-banner-controller.php
│   ├── class-notifications-controller.php
│   ├── class-onesignal-integration.php
│   └── class-activator.php
├── languages/
│   └── darzn-app-notifications-ar.po
├── public/
│   ├── css/
│   │   └── public-style.css
│   ├── js/
│   │   └── public-script.js
│   └── class-public.php
├── darzn-app-notifications.php
├── uninstall.php
└── README.txt
```

## Core Features

### 1. Banner Management System

#### Database Schema

```sql
CREATE TABLE {$wpdb->prefix}app_banners (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  description text,
  image_url varchar(255) NOT NULL,
  deep_link varchar(255),
  action_type varchar(50) DEFAULT 'none',
  action_data text,
  start_date datetime NOT NULL,
  end_date datetime NOT NULL,
  status varchar(20) DEFAULT 'draft',
  priority int(11) DEFAULT 0,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
```

#### Banner Types

1. **Promotional Banners**
   - Time-limited offers
   - Seasonal campaigns
   - Special discounts

2. **Informational Banners**
   - App updates
   - Service changes
   - Terms updates

3. **Product Highlight Banners**
   - New arrivals
   - Featured products
   - Best sellers

#### Action Types

- `none`: Display only
- `product`: Open specific product
- `category`: Open product category
- `url`: Open external URL
- `screen`: Navigate to specific app screen

### 2. Push Notification System

#### Database Schema

```sql
CREATE TABLE {$wpdb->prefix}app_notifications (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  message text NOT NULL,
  image_url varchar(255),
  deep_link varchar(255),
  action_type varchar(50) DEFAULT 'none',
  action_data text,
  segment varchar(50) DEFAULT 'all',
  scheduled_at datetime,
  sent_at datetime,
  status varchar(20) DEFAULT 'draft',
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
```

#### Notification Types

1. **Transactional Notifications**
   - Order status updates
   - Payment confirmations
   - Shipping updates

2. **Marketing Notifications**
   - Promotions and sales
   - New product arrivals
   - Abandoned cart reminders

3. **System Notifications**
   - App updates
   - Account security
   - Feature announcements

#### User Segmentation

- All users
- New users (registered in last 30 days)
- Inactive users (no activity for 30+ days)
- High-value customers (spent above threshold)
- Specific product category interested users

## API Endpoints

The plugin should provide the following REST API endpoints:

### Banner Endpoints

1. **Get Active Banners**
   - `GET /wp-json/darzn/v1/banners`
   - Returns all currently active banners sorted by priority

2. **Get Banner by ID**
   - `GET /wp-json/darzn/v1/banners/{id}`
   - Returns specific banner details

### Notification Endpoints

1. **Register Device**
   - `POST /wp-json/darzn/v1/devices/register`
   - Registers a device for push notifications
   - Params: `player_id`, `device_type`, `user_id` (optional)

2. **Get User Notifications**
   - `GET /wp-json/darzn/v1/notifications`
   - Returns notifications for the authenticated user

3. **Mark Notification as Read**
   - `POST /wp-json/darzn/v1/notifications/{id}/read`
   - Updates notification status to read

## Integration with OneSignal

### Configuration

```php
// OneSignal Integration Example
public function send_push_notification($notification_id) {
    $notification = $this->get_notification($notification_id);
    
    if ($notification->status !== 'ready') {
        return new WP_Error('invalid_status', 'Notification is not ready to be sent');
    }
    
    $fields = array(
        'app_id' => $this->onesignal_app_id,
        'headings' => array('en' => $notification->title),
        'contents' => array('en' => $notification->message),
        'included_segments' => array($this->get_segment_name($notification->segment)),
    );
    
    // Add image if present
    if (!empty($notification->image_url)) {
        $fields['big_picture'] = $notification->image_url;
        $fields['ios_attachments'] = array('id' => $notification->image_url);
    }
    
    // Add action data
    if ($notification->action_type !== 'none') {
        $fields['data'] = array(
            'action_type' => $notification->action_type,
            'action_data' => json_decode($notification->action_data)
        );
    }
    
    $response = wp_remote_post(
        'https://onesignal.com/api/v1/notifications',
        array(
            'headers' => array(
                'Authorization' => 'Basic ' . $this->onesignal_rest_api_key,
                'Content-Type' => 'application/json'
            ),
            'body' => json_encode($fields)
        )
    );
    
    // Update notification status
    if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) == 200) {
        $this->update_notification_status($notification_id, 'sent');
        return true;
    }
    
    return new WP_Error('sending_failed', 'Failed to send notification');
}
```

## Admin Interface

### Banner Management Interface

1. **Banner List View**
   - Display all banners with status and date range
   - Quick actions for edit/delete/duplicate
   - Filter by status and date

2. **Banner Edit/Create Form**
   - Title and description fields
   - Image upload with preview
   - Date range picker
   - Action type selector with dynamic fields
   - Status toggle (draft/active)
   - Priority setting

### Notification Management Interface

1. **Notification List View**
   - Display all notifications with status
   - Filter by type, status, and date
   - Metrics (sent count, open rate)

2. **Notification Edit/Create Form**
   - Title and message fields
   - Image upload (optional)
   - User segment selection
   - Action configuration
   - Schedule date/time
   - Send test notification option

3. **Analytics Dashboard**
   - Notification performance metrics
   - User engagement statistics
   - Best performing notification types

## Mobile App Integration

### Handling Banners in the Ionic App

```typescript
// Banner Service in the Ionic App
@Injectable({
  providedIn: 'root'
})
export class BannerService {
  private apiUrl = environment.apiUrl + '/wp-json/darzn/v1/banners';
  private banners: Banner[] = [];

  constructor(
    private http: HttpClient,
    private router: NavController
  ) {}

  // Fetch active banners from WordPress plugin API
  getActiveBanners(): Observable<Banner[]> {
    return this.http.get<Banner[]>(this.apiUrl).pipe(
      tap(banners => this.banners = banners),
      catchError(error => {
        console.error('Error fetching banners', error);
        return of([]);
      })
    );
  }

  // Handle banner click based on action type
  handleBannerAction(banner: Banner): void {
    switch(banner.action_type) {
      case 'product':
        this.router.navigateForward(`/product/${banner.action_data}`);
        break;
      case 'category':
        this.router.navigateForward(`/category/${banner.action_data}`);
        break;
      case 'url':
        window.open(banner.action_data, '_blank');
        break;
      case 'screen':
        this.router.navigateForward(`/${banner.action_data}`);
        break;
      default:
        // No action or display only
        break;
    }
  }
}
```

### Handling Push Notifications in the Ionic App

```typescript
// Push Notification Service in the Ionic App
@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private apiUrl = environment.apiUrl + '/wp-json/darzn/v1/devices';
  
  constructor(
    private platform: Platform,
    private oneSignal: OneSignal,
    private http: HttpClient,
    private router: NavController,
    private storage: Storage
  ) {}

  // Initialize OneSignal
  async initializeNotifications() {
    if (this.platform.is('cordova')) {
      try {
        await this.oneSignal.startInit(environment.oneSignalAppId);
        
        this.oneSignal.handleNotificationReceived().subscribe(data => {
          // Handle notification when app is in foreground
          console.log('Notification received:', data);
        });
        
        this.oneSignal.handleNotificationOpened().subscribe(async data => {
          // Handle notification when clicked
          console.log('Notification opened:', data);
          
          if (data.notification.payload.additionalData) {
            const notificationData = data.notification.payload.additionalData;
            this.handleNotificationAction(notificationData);
          }
        });
        
        const deviceState = await this.oneSignal.getDeviceState();
        await this.oneSignal.endInit();
        
        if (deviceState.userId) {
          this.registerDevice(deviceState.userId);
        }
        
        return true;
      } catch (error) {
        console.error('Error initializing notifications:', error);
        return false;
      }
    }
  }
  
  // Register device with WordPress plugin
  private registerDevice(playerId: string) {
    const deviceInfo = {
      player_id: playerId,
      device_type: this.platform.is('ios') ? 'ios' : 'android',
      user_id: null // Will be updated when user logs in
    };
    
    // Get user ID if available
    this.storage.get('user').then(user => {
      if (user && user.id) {
        deviceInfo.user_id = user.id;
      }
      
      // Register with the WordPress plugin
      this.http.post(`${this.apiUrl}/register`, deviceInfo).subscribe(
        response => console.log('Device registered successfully', response),
        error => console.error('Error registering device', error)
      );
    });
  }
  
  // Update user ID when user logs in
  updateUserAssociation(userId: number) {
    this.oneSignal.getDeviceState().then(deviceState => {
      if (deviceState.userId) {
        const deviceInfo = {
          player_id: deviceState.userId,
          user_id: userId
        };
        
        this.http.post(`${this.apiUrl}/update`, deviceInfo).subscribe(
          response => console.log('User association updated', response),
          error => console.error('Error updating user association', error)
        );
      }
    });
  }
  
  // Handle notification action
  private handleNotificationAction(data: any) {
    if (data.action_type && data.action_data) {
      switch(data.action_type) {
        case 'product':
          this.router.navigateForward(`/product/${data.action_data}`);
          break;
        case 'category':
          this.router.navigateForward(`/category/${data.action_data}`);
          break;
        case 'url':
          window.open(data.action_data, '_blank');
          break;
        case 'screen':
          this.router.navigateForward(`/${data.action_data}`);
          break;
        default:
          // No action
          break;
      }
    }
  }
}
```

## Best Practices

### Performance Considerations

1. **Optimize Database Queries**
   - Use indexing on frequently queried columns
   - Implement caching for banner data

2. **Image Optimization**
   - Resize banner images to appropriate dimensions
   - Use compression for notification images
   - Implement lazy loading for banner images

3. **API Response Caching**
   - Cache API responses on the server side
   - Implement client-side caching in the mobile app

### Security Considerations

1. **Data Validation**
   - Sanitize all user inputs
   - Validate request parameters
   - Implement rate limiting for API endpoints

2. **Authentication & Authorization**
   - Use WordPress nonces for admin actions
   - Implement JWT authentication for API endpoints
   - Use proper capability checks for admin functions

3. **Secure Storage**
   - Avoid storing sensitive data in plain text
   - Use WordPress encryption functions when necessary
   - Implement proper error logging without exposing sensitive data

### Localization

1. **Translation-Ready**
   - Use WordPress translation functions (`__()`, `_e()`)
   - Include Arabic translations for all user-facing strings
   - Support RTL layouts in admin interface

2. **Date/Time Handling**
   - Consider timezone differences
   - Format dates according to locale preferences
   - Store dates in UTC format in the database

## Testing Strategy

1. **Unit Testing**
   - Test individual functions and methods
   - Mock API responses and database interactions
   - Test error handling and edge cases

2. **Integration Testing**
   - Test API endpoints with real requests
   - Verify database interactions
   - Test OneSignal integration

3. **User Acceptance Testing**
   - Test admin interface usability
   - Verify notification delivery on various devices
   - Test banner display in the mobile app

## Implementation Phases

### Phase 1: Core Setup and Banner Management

1. Create plugin structure
2. Set up database tables
3. Implement banner management admin interface
4. Create banner REST API endpoints
5. Test banner functionality

### Phase 2: Push Notification System

1. Implement OneSignal integration
2. Create notification management admin interface
3. Develop notification scheduling system
4. Implement notification REST API endpoints
5. Test notification delivery

### Phase 3: Mobile App Integration and Enhancements

1. Implement banner display in mobile app
2. Set up push notification handling in mobile app
3. Add analytics and reporting features
4. Enhance user segmentation capabilities
5. Final testing and optimization

## Troubleshooting Guide

### Common Issues and Solutions

1. **Notifications Not Sending**
   - Verify OneSignal API key is correct
   - Check if user segments are properly configured
   - Examine OneSignal dashboard for error messages

2. **Banners Not Displaying**
   - Verify date range is valid and current
   - Check banner status is set to "active"
   - Inspect API response for errors

3. **Mobile App Integration Issues**
   - Verify API endpoints are accessible from the app
   - Check app permissions for push notifications
   - Examine app logs for connection errors

## Resources

1. WordPress Plugin Development: https://developer.wordpress.org/plugins/
2. WP REST API Handbook: https://developer.wordpress.org/rest-api/
3. OneSignal Documentation: https://documentation.onesignal.com/docs
4. Ionic Framework Documentation: https://ionicframework.com/docs

## Support and Maintenance

1. **Version Updates**
   - Keep WordPress compatibility information updated
   - Document changes in README.txt
   - Follow semantic versioning

2. **User Support**
   - Provide clear documentation for admins
   - Include troubleshooting FAQ
   - Offer contact information for support

3. **Ongoing Maintenance**
   - Schedule regular security audits
   - Monitor performance and optimize as needed
   - Keep dependencies updated