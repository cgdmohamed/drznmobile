import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { ImageCacheService } from '../../services/image-cache.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cached-image',
  templateUrl: './cached-image.component.html',
  styleUrls: ['./cached-image.component.scss'],
  standalone: false
})
export class CachedImageComponent implements OnInit, OnDestroy {
  @Input() src: string;
  @Input() alt: string = '';
  @Input() fallbackSrc: string = 'assets/icons/image-placeholder.png';
  @Input() spinner: boolean = false;
  @Input() spinnerColor: string = 'primary';
  @Input() spinnerSize: string = 'small';
  @Input() forceRefresh: boolean = false;
  @Input() loadingPlaceholder: boolean = true;
  @Input() cache: boolean = true;
  
  @Output() imageLoaded = new EventEmitter<{ success: boolean, src: string }>();
  
  isLoading: boolean = true;
  hasError: boolean = false;
  imageUrl: SafeUrl | string = '';
  private imageSubscription: Subscription;
  
  constructor(
    private imageCacheService: ImageCacheService,
    private sanitizer: DomSanitizer,
    private el: ElementRef
  ) { }
  
  ngOnInit() {
    this.loadImage();
  }
  
  ngOnDestroy() {
    if (this.imageSubscription) {
      this.imageSubscription.unsubscribe();
    }
  }
  
  /**
   * Load image from cache or network
   */
  loadImage() {
    if (!this.src) {
      this.handleError('No image source provided');
      return;
    }
    
    this.isLoading = true;
    this.hasError = false;
    
    // If caching is disabled, just use the source directly
    if (!this.cache) {
      this.imageUrl = this.src;
      this.isLoading = false;
      this.imageLoaded.emit({ success: true, src: this.src });
      return;
    }
    
    // Get image from cache or network
    this.imageSubscription = this.imageCacheService.getImageFromCache(this.src, this.forceRefresh).subscribe({
      next: (base64) => {
        this.imageUrl = this.sanitizer.bypassSecurityTrustUrl(base64);
        this.isLoading = false;
        this.imageLoaded.emit({ success: true, src: this.src });
      },
      error: (error) => {
        this.handleError(error.message);
      }
    });
  }
  
  /**
   * Handle error on the main image
   */
  handleImageError() {
    console.error('Image loading error on main image for:', this.src);
    
    // Check if the URL has Arabic or special characters and try a different encoding approach
    if (this.src && (this.containsArabic(this.src) || this.src.includes('%'))) {
      // Try to fix the URL directly if it contains encoded characters
      const fixedUrl = this.tryFixImageUrl(this.src);
      if (fixedUrl !== this.src) {
        console.log('Trying alternative encoding for image URL:', fixedUrl);
        this.imageUrl = this.sanitizer.bypassSecurityTrustUrl(fixedUrl);
        return; // Try with the fixed URL before showing error
      }
    }
    
    this.hasError = true;
    this.isLoading = false;
    this.imageLoaded.emit({ success: false, src: this.src });
  }
  
  /**
   * Handle error on the fallback image itself
   * Uses a simple SVG placeholder as last resort
   */
  usePlaceholderFallback() {
    console.error('Error loading fallback image:', this.fallbackSrc);
    // Create a simple data URI SVG as a last resort fallback
    const svgPlaceholder = `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23eaeaea" width="100" height="100"/%3E%3Cpath fill="%23999" d="M50 30 L70 70 L30 70 Z"/%3E%3C/svg%3E`;
    this.fallbackSrc = svgPlaceholder;
  }
  
  /**
   * Check if a string contains Arabic characters
   */
  private containsArabic(text: string): boolean {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicPattern.test(text);
  }
  
  /**
   * Try to fix problematic image URLs
   * This is a last resort method for handling problematic URLs
   */
  private tryFixImageUrl(url: string): string {
    try {
      // If URL is already percent-encoded, try to decode it first
      if (url.includes('%')) {
        try {
          const decoded = decodeURIComponent(url);
          // Extract the filename (last part after /)
          const lastSlashIdx = decoded.lastIndexOf('/');
          if (lastSlashIdx !== -1) {
            const basePath = decoded.substring(0, lastSlashIdx + 1);
            const filename = decoded.substring(lastSlashIdx + 1);
            // Encode just the filename
            return basePath + encodeURIComponent(filename);
          }
        } catch (e) {
          console.warn('Failed to decode URL:', e);
        }
      }
      
      // For non-encoded URLs, try a simple encoding approach
      const lastSlashIdx = url.lastIndexOf('/');
      if (lastSlashIdx !== -1) {
        const basePath = url.substring(0, lastSlashIdx + 1);
        const filename = url.substring(lastSlashIdx + 1);
        return basePath + encodeURIComponent(filename);
      }
    } catch (e) {
      console.error('Error fixing image URL:', e);
    }
    
    // If all attempts fail, return the original URL
    return url;
  }
  
  /**
   * Handle image loading error - used internally
   */
  private handleError(errorMessage: string) {
    console.error('Image loading error:', errorMessage, 'for image:', this.src);
    this.hasError = true;
    this.isLoading = false;
    this.imageLoaded.emit({ success: false, src: this.src });
  }
  
  /**
   * Force reload of the image
   */
  reloadImage() {
    if (this.imageSubscription) {
      this.imageSubscription.unsubscribe();
    }
    this.forceRefresh = true;
    this.loadImage();
  }
}