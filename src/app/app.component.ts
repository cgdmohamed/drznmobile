import { Component, OnInit, OnDestroy } from "@angular/core";
import { Platform, MenuController, ToastController, AlertController } from "@ionic/angular";
import { Storage } from "@ionic/storage-angular";
import { Subscription } from "rxjs";
import { Router, NavigationEnd } from "@angular/router";
import { filter } from "rxjs/operators";
import { AuthService } from "./services/auth.service";
import { JwtAuthService } from "./services/jwt-auth.service";
import { CartService } from "./services/cart.service";
import { NotificationService } from "./services/notification.service";
import { ThemeService } from "./services/theme.service";
import { SplashScreenService } from "./services/splash-screen.service";
import { WishlistService } from "./services/wishlist.service";
import { ConnectivityTesterService } from "./services/connectivity-tester.service";
import { StatusBar, Style } from '@capacitor/status-bar';
import { environment } from "../environments/environment";

// Define window with OneSignal for TypeScript
declare global {
  interface Window {
    OneSignal?: any;
  }
}

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
  styleUrls: ["app.component.scss"],
  standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  private themeSubscription: Subscription;
  private splashHiddenSubscription: Subscription;
  private routerSubscription: Subscription;
  showMenu: boolean = true; // Controls whether to show the menu
  private authPages = ['/login', '/register', '/forgot-password', '/otp', '/verify-otp', '/reset-password'];

  constructor(
    private platform: Platform,
    private storage: Storage,
    public authService: AuthService, // Changed to public for template access
    public jwtAuthService: JwtAuthService, // JWT auth service
    public cartService: CartService, // Changed to public for template access
    public notificationService: NotificationService, // Changed to public for template access
    public wishlistService: WishlistService, // Added for template access
    private themeService: ThemeService,
    private splashScreenService: SplashScreenService,
    private menuController: MenuController,
    private toastController: ToastController,
    private router: Router,
    private connectivityTester: ConnectivityTesterService,
    private alertController: AlertController
  ) {
    // Initialize storage first
    this.storage.create().then(() => {
      console.log('App component: Storage created successfully');
      // After storage is initialized, proceed with app initialization
      this.initializeApp();
      this.setupRouterListener();
    }).catch(error => {
      console.error('Error creating storage:', error);
    });
  }
  
  // Setup router event listener to toggle menu visibility
  private setupRouterListener() {
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // Check if current route is an auth page
        this.showMenu = !this.authPages.some(page => event.url.includes(page));
        
        // Close menu if on auth page
        if (!this.showMenu) {
          this.menuController.close('main-menu');
        }
      });
  }

  async ngOnInit() {
    // Log environment information
    console.log(`App running in ${environment.production ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    console.log(`Environment settings: API URL=${environment.apiUrl}, useDemoData=${environment.useDemoData}`);
    
    // Storage is already initialized in constructor

    // Initialize services that depend on storage
    await this.themeService.initialize();
    await this.cartService.initialize();
    
    // Initialize notifications - this will load stored notifications
    await this.notificationService.initPushNotifications();

    // Subscribe to theme changes
    this.themeSubscription = this.themeService.themeConfig.subscribe(
      (config) => {
        // Apply theme settings
        document.documentElement.dir = config.isRTL ? "rtl" : "ltr";
      },
    );
    
    // Test API connectivity if on mobile platform
    this.testApiConnectivity();

    // Show splash screen
    this.splashScreenService.init();

    // Hide splash screen when app is fully loaded
    this.splashHiddenSubscription = this.splashScreenService.isHidden.subscribe(
      (isHidden) => {
        if (!isHidden) {
          // We can perform additional actions when splash screen is shown
          console.log("Splash screen is showing");
        } else {
          // Actions after splash screen is hidden
          console.log("Splash screen is hidden");
        }
      },
    );

    // Hide splash screen after app is fully initialized (adjust timing if needed)
    setTimeout(() => {
      this.splashScreenService.hide();
    }, 3000);
  }

  ngOnDestroy() {
    // Clean up subscriptions
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }

    if (this.splashHiddenSubscription) {
      this.splashHiddenSubscription.unsubscribe();
    }
    
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  /**
   * Initialize OneSignal for push notifications
   */
  private initializeOneSignal() {
    // Make sure we have the secret key
    const appId = environment.oneSignalAppId || '';
    
    if (!window.OneSignal || !appId) {
      console.warn('OneSignal not available or app ID missing');
      return;
    }
    
    try {
      console.log('Initializing OneSignal with app ID:', appId);
      
      // Set app ID
      window.OneSignal.init({
        appId: appId,
        notifyButton: {
          enable: false,
        },
        allowLocalhostAsSecureOrigin: true
      });
      
      // Prompt user for notification permission
      window.OneSignal.showSlidedownPrompt();
      
      // Handle notification open events
      window.OneSignal.setNotificationOpenedHandler((jsonData: any) => {
        console.log('Notification opened:', jsonData);
        
        // Navigate to notifications page or specific content based on data
        if (jsonData.notification && jsonData.notification.additionalData) {
          const data = jsonData.notification.additionalData;
          
          // Handle different notification types (order updates, etc)
          if (data.orderId) {
            this.router.navigate(['/tabs/orders', data.orderId]);
          } else if (data.type === 'promotion') {
            this.router.navigate(['/tabs/home']);
          } else {
            // Default to notifications list
            this.router.navigate(['/tabs/notifications']);
          }
        }
      });
      
      console.log('OneSignal initialized successfully');
    } catch (error) {
      console.error('Error initializing OneSignal:', error);
    }
  }

  initializeApp() {
    // Log environment details again to ensure it's captured
    console.log(`[initializeApp] App running in ${environment.production ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
    console.log(`[initializeApp] Demo data usage setting: ${environment.useDemoData}`);
    
    this.platform.ready().then(async () => {
      try {
        // Configure status bar (for mobile devices only)
        if (this.platform.is('capacitor') || this.platform.is('cordova')) {
          try {
            await StatusBar.setBackgroundColor({ color: '#ec1c24' }); // Set red color matching the theme
            await StatusBar.setStyle({ style: Style.Light }); // Light text for dark background
            await StatusBar.setOverlaysWebView({ overlay: false }); // Don't overlay the webview
            
            // Initialize OneSignal for push notifications on native platforms
            this.initializeOneSignal();
          } catch (err) {
            console.error('Error configuring status bar:', err);
          }
        }
      
        // Try to get token and user from JWT auth
        const token = await this.jwtAuthService.getToken();
        const user = await this.jwtAuthService.getUser();
        
        // Always restore user session if we have user data, regardless of token status
        if (user) {
          console.log('User data found in storage, restoring session');
          
          // Force update of the user subject to ensure components know we're logged in
          this.jwtAuthService.setCurrentUser(user);
          
          // If we're on an auth page but we're already logged in, redirect to home
          if (this.authPages.some(page => window.location.href.includes(page))) {
            console.log('User is already logged in, redirecting to home');
            this.router.navigate(['/']);
          }
        }
        
        // Try to refresh token if we have one, but don't make login status dependent on it
        if (token) {
          console.log('JWT token found, verifying...');
          
          // Refresh token in the background
          this.jwtAuthService.refreshToken().subscribe({
            next: () => {
              console.log('JWT token refreshed successfully');
            },
            error: (error) => {
              console.error('JWT token refresh failed', error);
              // Don't clear auth data on refresh failure - it might just be a temporary server issue
              // The token might still be valid
            }
          });
        } else {
          console.log('No JWT token found');
        }
      } catch (error) {
        console.error('Error during app initialization', error);
      }

      // Initialize push notifications if on a device
      if (this.platform.is("capacitor") || this.platform.is("cordova")) {
        this.notificationService.initPushNotifications();
      }
    });
  }

  // Navigate to notifications page
  navigateToNotifications() {
    console.log('App component: calling notification service navigation method');
    // Close the menu first
    this.menuController.close("main-menu");
    // Use the centralized notification service navigation method
    this.notificationService.navigateToNotificationsPage();
  }

  // Logout method
  async logout() {
    // Unregister device from notifications
    await this.notificationService.unregisterDevice();
    
    // Clear sessions and data
    // Only use JWT logout
    this.jwtAuthService.logout().subscribe({
      next: () => {
        console.log('JWT logout successful');
      },
      error: (error) => {
        console.error('JWT logout failed', error);
        // Don't fall back to legacy logout, just log the error
      }
    });
    
    this.cartService.clearCart();
    this.menuController.close("main-menu");

    const toast = await this.toastController.create({
      message: "تم تسجيل الخروج بنجاح",
      duration: 2000,
      position: "bottom",
      color: "success",
    });

    await toast.present();
  }
  
  /**
   * Test API connectivity and show alert if there are issues
   */
  async testApiConnectivity() {
    console.log('Testing API connectivity...');
    
    this.connectivityTester.runAllTests().subscribe(
      async (result) => {
        console.log('Connectivity test results:', result);
        
        if (!result.overallSuccess) {
          // Only show alert in mobile environments
          if (this.platform.is('capacitor') || this.platform.is('cordova') || this.platform.is('hybrid')) {
            const alert = await this.alertController.create({
              header: 'Connection Issue',
              subHeader: 'Network Connectivity Problem',
              message: `We're having trouble connecting to our servers. 
                     ${result.message}
                     
                     Please check your internet connection and try again.`,
              buttons: ['OK']
            });
            await alert.present();
          } else {
            console.warn('Connectivity test failed, but suppressing alert in browser environment:', result.message);
          }
        } else {
          console.log('All connectivity tests passed successfully.');
        }
      },
      async (error) => {
        console.error('Error running connectivity tests:', error);
        
        // Only show alert in mobile environments
        if (this.platform.is('capacitor') || this.platform.is('cordova') || this.platform.is('hybrid')) {
          const alert = await this.alertController.create({
            header: 'Connection Issue',
            subHeader: 'Network Test Failed',
            message: `An error occurred while testing connectivity: ${error.message}`,
            buttons: ['OK']
          });
          await alert.present();
        }
      }
    );
  }
}