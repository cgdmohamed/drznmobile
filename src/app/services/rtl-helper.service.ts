import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { ThemeService } from './theme.service';

@Injectable({
  providedIn: 'root'
})
export class RtlHelperService {
  private _isRtl = new BehaviorSubject<boolean>(false);
  private _language = new BehaviorSubject<string>('ar'); // Default to Arabic for this app
  private isInitialized = false;
  private readonly LANG_STORAGE_KEY = 'app_language';

  constructor(
    private platform: Platform,
    private storage: Storage,
    private themeService: ThemeService
  ) {
    this.init();
  }

  /**
   * Initialize the RTL helper service
   */
  private async init() {
    if (this.isInitialized) return;
    
    // Check storage for saved language
    const savedLang = await this.storage.get(this.LANG_STORAGE_KEY);
    if (savedLang) {
      this.setLanguage(savedLang);
    } else {
      // Default language setting - Arabic
      this.setLanguage('ar');
    }
    
    this.isInitialized = true;
  }

  /**
   * Get current RTL state as observable
   */
  get isRtl(): Observable<boolean> {
    return this._isRtl.asObservable();
  }

  /**
   * Get current RTL state value
   */
  get isRtlValue(): boolean {
    return this._isRtl.value;
  }

  /**
   * Get current language as observable
   */
  get language(): Observable<string> {
    return this._language.asObservable();
  }

  /**
   * Get current language value
   */
  get languageValue(): string {
    return this._language.value;
  }

  /**
   * Set application language and update RTL state
   * @param lang Language code (e.g., 'ar', 'en')
   */
  async setLanguage(lang: string) {
    // Check if language is already set
    if (this._language.value === lang) return;
    
    // Update language
    this._language.next(lang);
    
    // Check if language is RTL
    const isRtl = this.isRtlLanguage(lang);
    this._isRtl.next(isRtl);
    
    // Update document direction
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    
    // Add RTL/LTR classes to body for styling
    if (isRtl) {
      document.body.classList.add('rtl');
      document.body.classList.remove('ltr');
    } else {
      document.body.classList.add('ltr');
      document.body.classList.remove('rtl');
    }
    
    // Update theme service (if needed)
    await this.themeService.setRTL(isRtl);
    
    // Save to storage
    await this.storage.set(this.LANG_STORAGE_KEY, lang);
  }

  /**
   * Check if a language is RTL
   * @param lang Language code
   */
  private isRtlLanguage(lang: string): boolean {
    // List of RTL languages
    const rtlLanguages = ['ar', 'fa', 'he', 'ur'];
    return rtlLanguages.includes(lang);
  }

  /**
   * Fix direction for form controls
   * Currently Ionic has some issues with RTL input alignment in v6
   * This method applies fixes for proper text alignment
   */
  applyRtlFixes() {
    if (this._isRtl.value) {
      // Apply RTL fixes to input elements
      const inputElements = document.querySelectorAll('ion-input, ion-textarea, ion-searchbar');
      inputElements.forEach(el => {
        el.classList.add('rtl-input-fix');
      });
      
      // Additional fixes for select and other components if needed
    }
  }

  /**
   * Get text direction based on content
   * Useful for mixed content situations
   * @param text The text to determine direction for
   */
  getTextDirection(text: string): 'rtl' | 'ltr' {
    if (!text) return this._isRtl.value ? 'rtl' : 'ltr';
    
    // Check first strong character
    const rtlChars = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    const ltrChars = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8]/;
    
    // Check if text contains RTL characters
    if (rtlChars.test(text)) return 'rtl';
    if (ltrChars.test(text)) return 'ltr';
    
    // Default to app direction
    return this._isRtl.value ? 'rtl' : 'ltr';
  }

  /**
   * Mirror value for RTL layouts
   * Useful for positioning, transforms, etc.
   * @param value The original value
   */
  mirrorForRtl(value: number): number {
    return this._isRtl.value ? -value : value;
  }
}