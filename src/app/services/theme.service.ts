import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Storage } from '@ionic/storage-angular';

export interface ThemeConfig {
  isRTL: boolean;
  darkMode: boolean;
  primaryColor: string;
  textSize: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private _themeConfig = new BehaviorSubject<ThemeConfig>({
    isRTL: true, // Default to RTL for Arabic
    darkMode: false,
    primaryColor: '#E9324A', // DARZN primary color
    textSize: 'medium' // Default text size
  });
  
  // Create dedicated subject for dark mode for easier subscription
  private _darkMode = new BehaviorSubject<boolean>(false);

  constructor(private storage: Storage) {
    // Storage initialization is done in app.component.ts
  }

  // Initialize the service (called from app.component.ts)
  async initialize() {
    await this.loadSavedTheme();
    return true;
  }

  get themeConfig() {
    return this._themeConfig.asObservable();
  }

  get currentTheme() {
    return this._themeConfig.getValue();
  }

  async loadSavedTheme() {
    try {
      const storedTheme = await this.storage.get('theme_config');
      if (storedTheme) {
        this._themeConfig.next(storedTheme);
        this._darkMode.next(storedTheme.darkMode); // Update the darkMode subject
      } else {
        // Set initial theme settings if not found in storage
        this.setInitialTheme();
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      // Set default theme
      this.setInitialTheme();
    }

    // Apply the loaded theme immediately
    this.applyTheme(this._themeConfig.getValue());
  }

  // Set the initial theme settings
  private setInitialTheme() {
    const defaultTheme: ThemeConfig = {
      isRTL: true, // Default to RTL for Arabic
      darkMode: false,
      primaryColor: '#E9324A',
      textSize: 'medium'
    };
    
    this._themeConfig.next(defaultTheme);
    this._darkMode.next(defaultTheme.darkMode);
    this.saveTheme(defaultTheme);
  }
  
  // Add getter for darkMode observable for easier subscription
  get darkMode() {
    return this._darkMode.asObservable();
  }
  
  // Get the current text size
  getTextSize(): string {
    return this._themeConfig.getValue().textSize || 'medium';
  }
  
  // Set text size
  setTextSize(size: string) {
    const currentTheme = this._themeConfig.getValue();
    const updatedTheme = { ...currentTheme, textSize: size };
    
    this._themeConfig.next(updatedTheme);
    this.applyTheme(updatedTheme);
    this.saveTheme(updatedTheme);
  }

  // Set RTL mode
  setRTL(isRTL: boolean) {
    const currentTheme = this._themeConfig.getValue();
    const updatedTheme = { ...currentTheme, isRTL };
    
    this._themeConfig.next(updatedTheme);
    this.applyTheme(updatedTheme);
    this.saveTheme(updatedTheme);
  }

  // Toggle dark mode
  toggleDarkMode() {
    const currentTheme = this._themeConfig.getValue();
    const updatedDarkMode = !currentTheme.darkMode;
    const updatedTheme = { ...currentTheme, darkMode: updatedDarkMode };
    
    this._themeConfig.next(updatedTheme);
    this._darkMode.next(updatedDarkMode); // Update the dedicated subject
    this.applyTheme(updatedTheme);
    this.saveTheme(updatedTheme);
  }

  // Set primary color
  setPrimaryColor(color: string) {
    const currentTheme = this._themeConfig.getValue();
    const updatedTheme = { ...currentTheme, primaryColor: color };
    
    this._themeConfig.next(updatedTheme);
    this.applyTheme(updatedTheme);
    this.saveTheme(updatedTheme);
  }

  // Apply theme settings to the DOM
  private applyTheme(theme: ThemeConfig) {
    // Apply RTL direction
    document.documentElement.dir = theme.isRTL ? 'rtl' : 'ltr';
    
    // Apply dark mode
    if (theme.darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    
    // Apply primary color
    document.documentElement.style.setProperty('--ion-color-primary', theme.primaryColor);
    
    // Calculate primary variants
    const primaryRGB = this.hexToRgb(theme.primaryColor);
    if (primaryRGB) {
      // Set primary color RGB for transparency calculations
      document.documentElement.style.setProperty('--ion-color-primary-rgb', `${primaryRGB.r},${primaryRGB.g},${primaryRGB.b}`);
      
      // Set contrast color
      const contrast = this.getContrastColor(primaryRGB.r, primaryRGB.g, primaryRGB.b);
      document.documentElement.style.setProperty('--ion-color-primary-contrast', contrast);
      
      // Set shade and tint
      const darkShade = this.shadeColor(theme.primaryColor, -20);
      const lightTint = this.shadeColor(theme.primaryColor, 30);
      document.documentElement.style.setProperty('--ion-color-primary-shade', darkShade);
      document.documentElement.style.setProperty('--ion-color-primary-tint', lightTint);
    }
  }

  // Save theme settings to storage
  private async saveTheme(theme: ThemeConfig) {
    await this.storage.set('theme_config', theme);
  }

  // Utility: Convert hex color to RGB
  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // Utility: Determine contrast color (black or white) based on background color
  private getContrastColor(r: number, g: number, b: number) {
    // Calculate luminance - W3C recommendation
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // Utility: Shade a color by percentage
  private shadeColor(color: string, percent: number) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.min(255, Math.max(0, R + R * percent / 100));
    G = Math.min(255, Math.max(0, G + G * percent / 100));
    B = Math.min(255, Math.max(0, B + B * percent / 100));

    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return `#${RR}${GG}${BB}`;
  }
}