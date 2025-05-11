# Changelog

All notable changes to the DARZN Mobile E-Commerce App will be documented in this file.

## [1.2.0] - 2025-05-11

### Added
- Two-row horizontal scrolling for categories section on home page
- Support for up to 20 categories visible in the scrolling interface
- Multi-line category name display (2 lines)
- Improved mobile responsiveness for category display

### Fixed
- Fixed order history not displaying properly on mobile devices by using absolute URLs
- Resolved URL construction issues for WooCommerce API endpoints on mobile
- Fixed TypeScript errors in trackOrderStatus method in OrderService
- Fixed splash screen resource conflicts by removing duplicate resources
- Corrected order tracking implementation to handle mobile platform detection properly
- Enhanced tax calculation with consistent 15% VAT application

### Improved
- Optimized category display layout for better user experience
- Enhanced category name visibility with multi-line support
- Added proper error handling for API connectivity issues
- Implemented consistent monetary value formatting with 2 decimal places

## [1.1.0] - 2025-04-28

### Added
- Multiple address management for users
- Brand filtering capabilities
- Product recommendations section
- User reviews implementation
- Product attributes and variations handling

### Fixed
- Resolved authentication issues with JWT token handling
- Fixed RTL layout issues in various components
- Improved error handling for API failures

## [1.0.0] - 2025-04-15

### Added
- Initial release with core e-commerce functionality
- WooCommerce REST API integration
- User authentication (login/registration)
- OTP verification with Taqnyat
- Checkout process implementation
- Payment methods integration (Moyasar, STCPay)
- Order tracking system
- RTL support for Arabic language
- Demo/fallback products when API is unavailable