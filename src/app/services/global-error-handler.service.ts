import { ErrorHandler, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Platform } from '@ionic/angular';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandlerService implements ErrorHandler {
  private isMobile: boolean;
  private isProduction: boolean;

  constructor(private platform: Platform) {
    this.isMobile = this.platform.is('hybrid') || 
                    this.platform.is('capacitor') || 
                    this.platform.is('cordova');
    this.isProduction = environment.production;
    
    console.log(`GlobalErrorHandler initialized. Mobile: ${this.isMobile}, Production: ${this.isProduction}`);
  }

  /**
   * Handle all unhandled exceptions in the app
   */
  handleError(error: Error | HttpErrorResponse): void {
    // Log basic information about the error
    const errorInfo: any = {
      name: error.name,
      message: error.message,
      timestamp: new Date().toISOString(),
      platform: this.isMobile ? 'mobile' : 'web',
      mode: this.isProduction ? 'production' : 'development'
    };
    
    // Add stack trace if available (standard Error object)
    if ('stack' in error && error.stack) {
      errorInfo.stack = error.stack;
    }
    
    console.error(`[GlobalErrorHandler] Error detected:`, errorInfo);
    
    // For HTTP errors, log additional details
    if (error instanceof HttpErrorResponse) {
      this.handleHttpError(error);
    } else {
      this.handleNonHttpError(error);
    }
  }
  
  /**
   * Handle HTTP errors with detailed logging
   */
  private handleHttpError(error: HttpErrorResponse): void {
    // Get network-related details
    const networkInfo = {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      headers: error.headers?.keys().map(key => `${key}: ${error.headers.get(key)}`),
      error: error.error
    };
    
    console.error(`[GlobalErrorHandler] HTTP Error (${error.status}):`, networkInfo);
    
    // Add platform-specific error handling
    if (this.isMobile) {
      this.handleMobileHttpError(error);
    }
    
    // Different handling based on status code
    switch (error.status) {
      case 0:
        console.error('[GlobalErrorHandler] Network connectivity issue detected.');
        break;
      case 401:
        console.error('[GlobalErrorHandler] Authentication error.');
        break;
      case 403:
        console.error('[GlobalErrorHandler] Authorization error.');
        break;
      case 404:
        console.error('[GlobalErrorHandler] Resource not found.');
        break;
      case 500:
        console.error('[GlobalErrorHandler] Server error.');
        break;
      default:
        if (error.status >= 400 && error.status < 500) {
          console.error('[GlobalErrorHandler] Client error.');
        } else if (error.status >= 500) {
          console.error('[GlobalErrorHandler] Server error.');
        }
    }
  }
  
  /**
   * Handle non-HTTP errors
   */
  private handleNonHttpError(error: Error): void {
    // Check for known error types
    if (error.name === 'TypeError') {
      console.error('[GlobalErrorHandler] TypeError detected - likely a null/undefined access issue.');
    } else if (error.name === 'SyntaxError') {
      console.error('[GlobalErrorHandler] SyntaxError detected - likely a JSON parsing issue.');
    } else if (error.name === 'ReferenceError') {
      console.error('[GlobalErrorHandler] ReferenceError detected - accessing an undefined variable.');
    }
    
    // Log stack trace for debugging
    console.error('[GlobalErrorHandler] Stack trace:', error.stack);
  }
  
  /**
   * Mobile-specific HTTP error handling
   */
  private handleMobileHttpError(error: HttpErrorResponse): void {
    // Mobile-specific checks
    if (error.status === 0) {
      // Check if we have network connectivity
      console.error('[GlobalErrorHandler] Mobile connectivity issue. URL attempted:', error.url);
    }
    
    // More detailed information for troubleshooting
    console.error('[GlobalErrorHandler] Mobile HTTP error details:', {
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      platform: this.platform.platforms(),
      height: this.platform.height(),
      width: this.platform.width(),
      isLandscape: this.platform.isLandscape(),
      isPortrait: this.platform.isPortrait()
    });
  }
}