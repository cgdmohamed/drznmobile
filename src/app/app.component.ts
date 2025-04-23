import { Component, OnInit, OnDestroy } from "@angular/core";
import { Platform, MenuController, ToastController } from "@ionic/angular";
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
    private cartService: CartService,
    private notificationService: NotificationService,
    private themeService: ThemeService,
    private splashScreenService: SplashScreenService,
    private menuController: MenuController,
    private toastController: ToastController,
    private router: Router
  ) {
    this.initializeApp();
    this.setupRouterListener();
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
    // Initialize storage
    await this.storage.create();
    console.log('Storage initialized successfully');

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

  initializeApp() {
    this.platform.ready().then(() => {
      // Auto login using either auth service (will be gradually migrated to JWT)
      this.authService.autoLogin().subscribe();
      
      // JWT auth is initialized automatically when injected
      // Add jwt-based auth check/verification here if needed

      // Initialize push notifications if on a device
      if (this.platform.is("capacitor") || this.platform.is("cordova")) {
        this.notificationService.initPushNotifications();
      }
    });
  }

  // Logout method
  async logout() {
    // Unregister device from notifications
    await this.notificationService.unregisterDevice();
    
    // Clear sessions and data
    this.authService.logout();
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
}
