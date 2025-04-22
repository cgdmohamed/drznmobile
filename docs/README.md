# DARZN WordPress Plugin Documentation

## Overview

This directory contains comprehensive documentation and sample code for developing a WordPress plugin that manages in-app banners and push notifications for the DARZN mobile app.

## Contents

1. **wordpress-notification-plugin-guide.md** - Complete development guide with all requirements, features, and implementation details
2. **darzn-app-notifications.php** - Main plugin file sample
3. **class-darzn-app-notifications.php** - Core plugin class sample
4. **class-api.php** - REST API implementation sample
5. **class-onesignal-integration.php** - OneSignal integration for push notifications

## Key Functionality

The plugin enables several key features:

1. **Banner Management System**
   - Create and manage in-app promotional banners
   - Schedule banners with start/end dates
   - Add deep linking and actions to banners

2. **Push Notification System**
   - Send push notifications to app users
   - Support for transactional, marketing, and system notifications
   - User segmentation for targeted notifications
   - Schedule notifications for future delivery

3. **REST API Endpoints**
   - Get active banners
   - Register devices for push notifications
   - Get user notifications
   - Mark notifications as read

## Integration with Mobile App

The documentation includes guidance and code samples for integrating with the DARZN Ionic mobile app, including:

1. Banner display and interaction
2. Push notification handling
3. Device registration for notifications
4. Deep linking from notifications to app screens or content

## Implementation Steps

To implement this plugin:

1. Create the basic plugin structure
2. Set up database tables for banners and notifications
3. Implement the admin interface for managing banners and notifications
4. Create REST API endpoints for mobile app integration
5. Integrate with OneSignal for push notification delivery

For detailed implementation guidance, refer to the wordpress-notification-plugin-guide.md file.

## Technical Requirements

- WordPress 5.8+
- PHP 7.4+
- MySQL 5.7+
- WooCommerce 6.0+ (if integrating with e-commerce features)
- OneSignal account and API key for push notifications

## Resources

For additional information and resources, see:

- [WordPress Plugin Development](https://developer.wordpress.org/plugins/)
- [WP REST API Handbook](https://developer.wordpress.org/rest-api/)
- [OneSignal Documentation](https://documentation.onesignal.com/docs)
- [Ionic Framework Documentation](https://ionicframework.com/docs)