import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { SplashScreen as CapacitorSplashScreen } from '@capacitor/splash-screen';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SplashScreenService {
  private _isHidden = new BehaviorSubject<boolean>(false);
  private splashElement: HTMLElement | null = null;
  private splashTimer: any = null;

  constructor(private platform: Platform) {}

  // Initialize the splash screen
  init() {
    // For native devices, use Capacitor SplashScreen
    if (this.platform.is('capacitor') || this.platform.is('cordova')) {
      this.platform.ready().then(() => {
        CapacitorSplashScreen.hide();
      });
      return;
    }

    // For web or PWA, create and show a custom splash screen
    this.createSplashScreen();
    
    // Hide after a certain period (minimum 2 seconds, or when app is fully loaded)
    this.splashTimer = setTimeout(() => {
      this.hideSplashScreen();
    }, 3000);
  }

  // Manually hide the splash screen
  hide() {
    if (this.platform.is('capacitor') || this.platform.is('cordova')) {
      CapacitorSplashScreen.hide();
    } else {
      this.hideSplashScreen();
    }
    
    // Clear timer if exists
    if (this.splashTimer) {
      clearTimeout(this.splashTimer);
      this.splashTimer = null;
    }
  }

  // Create the custom splash screen for web/PWA
  private createSplashScreen() {
    // Check if splash element already exists
    if (document.getElementById('custom-splash-screen')) {
      return;
    }

    // Create splash screen element
    const splash = document.createElement('div');
    splash.id = 'custom-splash-screen';
    splash.style.position = 'fixed';
    splash.style.top = '0';
    splash.style.left = '0';
    splash.style.right = '0';
    splash.style.bottom = '0';
    splash.style.zIndex = '99999';
    splash.style.background = '#E9324A';
    splash.style.display = 'flex';
    splash.style.flexDirection = 'column';
    splash.style.alignItems = 'center';
    splash.style.justifyContent = 'center';
    splash.style.transition = 'opacity 0.5s ease-out';

    // Add logo
    const logo = document.createElement('img');
    logo.src = 'assets/images/logo.svg';
    logo.alt = 'DARZN Logo';
    logo.style.width = '180px';
    logo.style.marginBottom = '30px';
    splash.appendChild(logo);

    // Add spinner
    const spinnerContainer = document.createElement('div');
    spinnerContainer.style.width = '40px';
    spinnerContainer.style.height = '40px';
    spinnerContainer.style.position = 'relative';

    const spinner = document.createElement('div');
    spinner.style.border = '4px solid rgba(255, 255, 255, 0.3)';
    spinner.style.borderRadius = '50%';
    spinner.style.borderTop = '4px solid #ffffff';
    spinner.style.width = '40px';
    spinner.style.height = '40px';
    spinner.style.animation = 'splash-spin 1s linear infinite';
    spinnerContainer.appendChild(spinner);
    splash.appendChild(spinnerContainer);

    // Add animation style
    const style = document.createElement('style');
    style.textContent = `
      @keyframes splash-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Append to body
    document.body.appendChild(splash);
    this.splashElement = splash;
  }

  // Hide the custom splash screen
  private hideSplashScreen() {
    if (!this.splashElement) {
      this.splashElement = document.getElementById('custom-splash-screen');
    }

    if (this.splashElement) {
      // Fade out
      this.splashElement.style.opacity = '0';
      
      // Remove after animation
      setTimeout(() => {
        if (this.splashElement && this.splashElement.parentNode) {
          this.splashElement.parentNode.removeChild(this.splashElement);
          this._isHidden.next(true);
        }
      }, 500);
    }
  }

  // Check if splash screen is hidden
  get isHidden() {
    return this._isHidden.asObservable();
  }
}