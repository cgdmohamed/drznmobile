# DARZN - Mobile E-Commerce App

An advanced mobile e-commerce application tailored for the Middle Eastern market, delivering a culturally-sensitive and technologically sophisticated shopping experience with enhanced form management and user interaction capabilities.

## Key Features

- **Middle Eastern Focus**: Fully designed for Arabic users with RTL support
- **WooCommerce Integration**: Connects to a WooCommerce backend API for product management
- **Mobile-first Design**: Responsive UI optimized for mobile devices
- **Enhanced Category Navigation**: Two-row horizontal scrolling with support for up to 20 categories
- **Payment Integrations**: 
  - Moyasar payment gateway
  - STCPay for mobile payments
  - Cash on Delivery (COD)
- **OTP Verification**: User authentication via Taqnyat SMS service
- **Push Notifications**: Integration with OneSignal for push notifications
- **Enhanced UI/UX**: Smooth transitions, micro-animations, and elegant form handling
- **Product Recommendations**: AI-based personalized product recommendation system
- **Multi-address Support**: Multiple saved addresses for shipping/billing
- **Order Tracking**: Real-time order status tracking and history

## Technology Stack

- **Ionic Framework**: Cross-platform mobile development
- **Angular**: Frontend framework
- **Capacitor**: Native functionality access
- **NgRx/RxJS**: State management and reactive programming
- **Swiper**: Touch slider for product carousels
- **Ionic Storage**: Local data persistence

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- Ionic CLI

### Installation

1. Clone the repository
```bash
git clone https://github.com/username/darzn-app.git
cd darzn-app
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables:
   - Create `src/environments/environment.ts` and `environment.prod.ts` with your API keys

4. Start development server
```bash
ionic serve
```

### Building for Production

```bash
ionic build --prod
```

### Android Publishing

To build and publish the app for Android:

1. Build the app:
```bash
ng build --configuration production
npx cap sync android
```

2. Open the Android project in Android Studio:
```bash
npx cap open android
```

3. Configure signing in Android Studio:
   - Generate a signing key using Android Studio's Build > Generate Signed Bundle/APK
   - Configure the key in the app's build.gradle
   - Update the versionCode and versionName in build.gradle

4. Build the release version:
   - In Android Studio, select Build > Build Bundle(s) / APK(s) > Build Bundle(s)
   - Or use Gradle: `./gradlew bundleRelease`

5. Submit to Google Play Store:
   - Log in to the Google Play Console
   - Create a new app or update an existing one
   - Upload the AAB (Android App Bundle) file
   - Fill in store listing details and submit for review

## API Configuration

The application requires the following API keys:

1. **WooCommerce**: Consumer Key and Secret (configured in environment files)
2. **Moyasar**: Publishable Key for payment processing
3. **Taqnyat**: API Key for SMS/OTP verification
4. **OneSignal**: App ID for push notifications

## Features Implemented

- [x] Product browsing & searching
- [x] Enhanced category navigation with two-row horizontal scrolling
- [x] Cart management with tax calculation
- [x] User authentication (login/registration)
- [x] OTP verification with Taqnyat
- [x] Checkout process
- [x] Payment methods integration (Moyasar, STCPay)
- [x] Order tracking and history
- [x] User profile management
- [x] Multiple address management
- [x] Product recommendations
- [x] User reviews
- [x] Brand filtering
- [x] Product attributes and variations
- [x] RTL support for Arabic language
- [x] Demo/fallback products when API is unavailable
- [x] Cross-platform compatibility (web, Android)

## OTP Verification System

The app uses Taqnyat SMS service for OTP (One-Time Password) verification. The implementation includes:

- Phone number registration and validation
- OTP sending via SMS using Taqnyat API
- Four-digit OTP verification with visual feedback
- Resend OTP functionality with timing controls
- Error handling for various API response formats
- OTP verification during checkout for guest users

## Recent Improvements

- [x] Enhanced category display with two-row horizontal scrolling
- [x] Fixed order history display on mobile devices
- [x] Fixed URL construction issues for WooCommerce API endpoints on mobile
- [x] Resolved TypeScript errors in order tracking functionality
- [x] Fixed splash screen resource conflicts
- [x] Implemented consistent tax calculation throughout the app

## Pending Tasks

- [ ] Fix component declaration issues in Angular modules
- [ ] Complete Android build and publishing process
- [ ] Implement OneSignal push notifications
- [ ] Add Apple Pay support for iOS
- [ ] Optimize performance for product loading
- [ ] Improve offline experience
- [ ] Add unit and integration tests

## Changelog

For a complete list of changes and version history, please see the [CHANGELOG.md](./CHANGELOG.md) file.

## Mobile Device Troubleshooting

Common issues and solutions for mobile platform deployment:

1. **API Connectivity Issues**: On mobile devices, ensure absolute URLs are used for API endpoints instead of relative paths
2. **WooCommerce API Authentication**: For mobile builds, consumer keys should be included directly in the URL
3. **Splash Screen Conflicts**: Avoid duplicate splash screen resources in Android builds
4. **Order History Not Displaying**: Check URL construction in network requests for proper formatting
5. **Android Build Failures**: Make sure all TypeScript errors are resolved before attempting a production build

## Contributing

Please refer to our contribution guidelines for information about how to get involved.

## License

This project is licensed under the MIT License - see the LICENSE file for details.