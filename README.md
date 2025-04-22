# DARZN - Mobile E-Commerce App

An advanced mobile e-commerce application tailored for the Middle Eastern market, delivering a culturally-sensitive and technologically sophisticated shopping experience with enhanced form management and user interaction capabilities.

## Key Features

- **Middle Eastern Focus**: Fully designed for Arabic users with RTL support
- **WooCommerce Integration**: Connects to a WooCommerce backend API for product management
- **Mobile-first Design**: Responsive UI optimized for mobile devices
- **Payment Integrations**: 
  - Moyasar payment gateway
  - Apple Pay for iOS devices
  - Cash on Delivery (COD)
- **OTP Verification**: User authentication via Taqnyat SMS service
- **Push Notifications**: Integration with OneSignal for push notifications
- **Enhanced UI/UX**: Smooth transitions, micro-animations, and elegant form handling
- **Product Recommendations**: AI-based personalized product recommendation system
- **Multi-address Support**: Multiple saved addresses for shipping/billing

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

## API Configuration

The application requires the following API keys:

1. **WooCommerce**: Consumer Key and Secret (configured in environment files)
2. **Moyasar**: Publishable Key for payment processing
3. **Taqnyat**: API Key for SMS/OTP verification
4. **OneSignal**: App ID for push notifications

## Features Implemented

- [x] Product browsing & searching
- [x] Category navigation
- [x] Cart management
- [x] User authentication (login/registration)
- [x] OTP verification
- [x] Checkout process
- [x] Payment methods integration
- [x] Order tracking
- [x] User profile management
- [x] Multiple address management
- [x] Product recommendations
- [x] User reviews
- [x] Brand filtering
- [x] Product attributes and variations

## Contributing

Please refer to our contribution guidelines for information about how to get involved.

## License

This project is licensed under the MIT License - see the LICENSE file for details.