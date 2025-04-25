# DARZN WooCommerce Mobile App Integration Plugin

## Overview

The DARZN WooCommerce Integration Plugin extends your WooCommerce store with advanced capabilities for the DARZN mobile application. This plugin enables seamless integration between your WordPress site and the mobile shopping experience, providing push notifications, JWT authentication, banner management, and more.

## Key Features

### 1. JWT Authentication

Secure JSON Web Token (JWT) authentication for mobile app users, allowing seamless and secure login to WooCommerce accounts.

- **Endpoints:**
  - `/wp-json/jwt-auth/v1/token` - Generate JWT token with username/password
  - `/wp-json/jwt-auth/v1/token/validate` - Validate existing token
  - `/wp-json/jwt-auth/v1/token/refresh` - Refresh expired token

### 2. Push Notification System

Send targeted push notifications to your customers via OneSignal integration.

- **Features:**
  - Order status notifications (new, processing, completed, cancelled)
  - Stock alerts (back in stock, low stock)
  - Price drop alerts
  - Promotional campaign notifications
  - Abandoned cart reminders

- **Admin Interface:**
  - Manage notification templates
  - Schedule promotional notifications
  - View notification delivery statistics

### 3. Banner Management

Manage promotional banners and sliders displayed in the mobile app.

- **Features:**
  - Create, edit, and schedule banners
  - Target banners to specific user groups
  - Link banners to products, categories, or external URLs
  - Track banner performance with click-through analytics

- **Banner Types:**
  - Home page sliders
  - Category banners
  - Promotional popups
  - Special offer cards

### 4. Order Management

Enhanced order processing capabilities for the mobile app.

- **Features:**
  - Real-time order status updates
  - Push notifications for order status changes
  - Integration with delivery tracking systems
  - Support for digital product delivery

### 5. User Profile Management

Extended user profile management for mobile app users.

- **Features:**
  - User login and registration
  - Password reset via email or SMS
  - OTP verification for secure transactions
  - Multiple shipping address management
  - Order history and tracking

## Installation

1. Download the DARZN WooCommerce Integration Plugin
2. Upload to your WordPress site via Plugins > Add New > Upload Plugin
3. Activate the plugin
4. Navigate to DARZN Settings in your WordPress admin dashboard
5. Configure API keys and integration settings

## Configuration

### OneSignal Integration

1. Create a OneSignal account and app at https://onesignal.com
2. Copy your OneSignal App ID and REST API Key
3. Enter these credentials in the DARZN Settings > Notifications tab
4. Configure notification templates and triggers

### JWT Authentication

1. Navigate to DARZN Settings > Authentication
2. Set JWT secret key (or use the auto-generated one)
3. Configure token expiration settings
4. Set allowed origins for API requests

### Banner Management

1. Go to DARZN > Banners
2. Add new banners with images, links, and scheduling
3. Organize banners by position and priority
4. Enable/disable banners as needed

## API Endpoints

### Authentication Endpoints

- `POST /wp-json/jwt-auth/v1/token` - Generate JWT token
  - Parameters: `username`, `password`
  - Returns: `token`, `user_id`, `user_email`, `user_nicename`

- `POST /wp-json/jwt-auth/v1/token/validate` - Validate token
  - Headers: `Authorization: Bearer {token}`
  - Returns: Success/Error message

- `POST /wp-json/jwt-auth/v1/token/refresh` - Refresh token
  - Headers: `Authorization: Bearer {token}`
  - Returns: New `token`

### Notification Endpoints

- `POST /wp-json/darzn/v1/devices` - Register device for push notifications
  - Parameters: `user_id`, `player_id`, `platform`
  - Returns: Success/Error message

- `GET /wp-json/darzn/v1/notifications` - Get user notifications
  - Headers: `Authorization: Bearer {token}`
  - Returns: Array of notification objects

- `PUT /wp-json/darzn/v1/notifications/{id}/read` - Mark notification as read
  - Headers: `Authorization: Bearer {token}`
  - Returns: Success/Error message

### Banner Endpoints

- `GET /wp-json/darzn/v1/banners` - Get active banners
  - Parameters: `position`, `limit`
  - Returns: Array of banner objects

- `GET /wp-json/darzn/v1/banners/{id}` - Get specific banner
  - Returns: Banner object

## Hooks and Filters

### Actions

- `darzn_after_user_login` - Triggered after successful user login
- `darzn_order_status_changed` - Triggered when order status changes
- `darzn_banner_clicked` - Triggered when banner is clicked
- `darzn_notification_sent` - Triggered after notification is sent

### Filters

- `darzn_user_jwt_data` - Filter JWT token data before generation
- `darzn_notification_content` - Filter notification content before sending
- `darzn_banner_query_args` - Filter banner query arguments
- `darzn_api_response` - Filter API response data

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify JWT secret key is correctly set
   - Check user credentials are valid
   - Ensure token hasn't expired

2. **Push Notification Issues**
   - Verify OneSignal credentials are correct
   - Check if user has granted notification permissions
   - Ensure device is properly registered

3. **Banner Display Problems**
   - Check if banners are active and scheduled correctly
   - Verify image URLs are accessible
   - Check positioning and priority settings

## Support and Updates

For support inquiries, feature requests, or bug reports, please contact us at support@darzn.com or visit our support portal at https://support.darzn.com.

This plugin is regularly updated to maintain compatibility with the latest versions of WordPress, WooCommerce, and the DARZN mobile application.

## Changelog

### Version 2.3.0
- Added banner analytics dashboard
- Enhanced push notification delivery system
- Improved OTP verification process
- Added support for multi-language notifications
- Fixed various minor bugs

### Version 2.2.0
- Added support for scheduled banners
- Enhanced JWT token security
- Added notification grouping by type
- Improved device management interface
- Fixed compatibility issues with WooCommerce 7.x

### Version 2.1.0
- Added order push notification system
- Enhanced banner management with scheduling
- Integrated with STCPay payment gateway
- Added support for Apple Pay integrations
- Improved performance and security