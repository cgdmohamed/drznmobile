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
   * Handle image loading error
   */
  private handleError(errorMessage: string) {
    console.error('Image loading error:', errorMessage, 'for image:', this.src);
    this.hasError = true;
    this.isLoading = false;
    this.imageUrl = this.fallbackSrc;
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