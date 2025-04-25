import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from, throwError } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';

/**
 * Interface for cached image entry
 */
export interface CachedImage {
  url: string;
  base64: string;
  expires: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageCacheService {
  private readonly IMAGE_CACHE_PREFIX = 'img_cache_';
  private readonly CACHE_EXPIRY_DAYS = 7; // Images expire after 7 days
  private readonly MAX_CACHED_IMAGES = 200; // Maximum number of cached images
  private cacheInitialized = false;
  private cacheMap = new Map<string, CachedImage>();
  private pendingImages = new Map<string, Observable<string>>();

  constructor(
    private storage: Storage,
    private http: HttpClient
  ) {
    this.init();
  }

  /**
   * Initialize the cache service
   */
  private async init() {
    if (this.cacheInitialized) return;
    
    try {
      await this.loadCachedImages();
      this.cacheInitialized = true;
      console.log('Image cache initialized with', this.cacheMap.size, 'images');
      
      // Cleanup expired images periodically (every hour in this example)
      setInterval(() => this.cleanupExpiredImages(), 60 * 60 * 1000);
    } catch (error) {
      console.error('Error initializing image cache', error);
    }
  }

  /**
   * Load cached images from storage
   */
  private async loadCachedImages() {
    const keys = await this.storage.keys();
    const imageCacheKeys = keys.filter(key => key.startsWith(this.IMAGE_CACHE_PREFIX));
    
    for (const key of imageCacheKeys) {
      const cachedImage = await this.storage.get(key) as CachedImage;
      if (cachedImage) {
        this.cacheMap.set(cachedImage.url, cachedImage);
      }
    }
  }

  /**
   * Get an image from the cache or from the network
   * @param imageUrl URL of the image to retrieve
   * @param forceRefresh Force refresh from network ignoring the cache
   */
  getImageFromCache(imageUrl: string, forceRefresh = false): Observable<string> {
    if (!imageUrl) {
      return throwError(() => new Error('Image URL is required'));
    }

    // Return pending request if already in progress
    if (this.pendingImages.has(imageUrl)) {
      return this.pendingImages.get(imageUrl)!;
    }
    
    // Check if image is in cache and not expired
    if (!forceRefresh && this.cacheMap.has(imageUrl)) {
      const cachedImage = this.cacheMap.get(imageUrl)!;
      
      // Check if image is expired
      if (cachedImage.expires > Date.now()) {
        return of(cachedImage.base64);
      }
    }
    
    // Fetch image from network
    const fetchObservable = this.fetchAndCacheImage(imageUrl).pipe(
      tap(() => {
        // Remove from pending requests when complete
        this.pendingImages.delete(imageUrl);
      })
    );
    
    // Store the pending request
    this.pendingImages.set(imageUrl, fetchObservable);
    
    return fetchObservable;
  }

  /**
   * Fetch an image from the network and cache it
   * @param imageUrl URL of the image to fetch
   */
  private fetchAndCacheImage(imageUrl: string): Observable<string> {
    // Encode the URL properly to handle Unicode characters (like Arabic)
    const encodedUrl = this.encodeSpecialChars(imageUrl);
    
    return this.http.get(encodedUrl, { responseType: 'blob' }).pipe(
      switchMap(blob => {
        return from(new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            this.cacheImage(imageUrl, base64data) // Store using original URL as key
              .then(() => resolve(base64data))
              .catch(error => reject(error));
          };
          reader.onerror = () => {
            reject(new Error('Failed to read image blob'));
          };
          reader.readAsDataURL(blob);
        }));
      }),
      catchError(error => {
        console.error('Error fetching image', encodedUrl, error);
        return throwError(() => new Error(`Failed to fetch image: ${error.message}`));
      })
    );
  }
  
  /**
   * Properly encode URL with special characters while preserving URL structure
   * @param url The URL to encode
   */
  private encodeSpecialChars(url: string): string {
    try {
      // Parse the URL to get its components
      const parsedUrl = new URL(url);
      
      // Split the pathname into segments and encode each segment separately
      const pathSegments = parsedUrl.pathname.split('/').map((segment, index) => {
        // Skip empty segments (like the one after the first slash)
        if (segment === '' && index !== 0) return '';
        
        // Encode each segment (except for '/', which is preserved by the split/join)
        return encodeURIComponent(segment);
      });
      
      // Rebuild the pathname
      parsedUrl.pathname = pathSegments.join('/');
      
      // Return the encoded URL
      return parsedUrl.toString();
    } catch (e) {
      // If URL parsing fails, try a simpler encoding approach
      console.warn('Failed to parse URL:', url, e);
      
      // Try to preserve the URL structure while encoding problematic parts
      try {
        // Split by '/' and encode each part (keeping the / unchanged)
        const urlParts = url.split('/');
        
        // Find the protocol and domain parts (they don't need encoding)
        const protocolIdx = url.indexOf('://');
        const domainEndIdx = protocolIdx > -1 ? url.indexOf('/', protocolIdx + 3) : -1;
        
        // If we have a valid URL structure, preserve protocol and domain
        if (protocolIdx > -1 && domainEndIdx > -1) {
          const protocol = url.substring(0, protocolIdx + 3); // includes ://
          const domain = url.substring(protocolIdx + 3, domainEndIdx);
          const path = url.substring(domainEndIdx);
          
          // Encode only the path part
          const encodedPath = path.split('/')
            .map((part, idx) => idx === 0 ? part : encodeURIComponent(part))
            .join('/');
            
          return protocol + domain + encodedPath;
        }
      } catch (encodingError) {
        console.error('Error encoding URL parts:', encodingError);
      }
      
      // Last resort: return the original URL
      return url;
    }
  }

  /**
   * Cache an image to storage
   * @param url URL of the image
   * @param base64 Base64 encoded image data
   */
  private async cacheImage(url: string, base64: string): Promise<void> {
    try {
      // Create expiry date (7 days from now)
      const expiryDate = Date.now() + (this.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      
      const cacheEntry: CachedImage = {
        url,
        base64,
        expires: expiryDate
      };
      
      // Add to in-memory cache
      this.cacheMap.set(url, cacheEntry);
      
      // Save to storage
      const storageKey = this.IMAGE_CACHE_PREFIX + this.hashUrl(url);
      await this.storage.set(storageKey, cacheEntry);
      
      // Check if we need to clean up old images
      if (this.cacheMap.size > this.MAX_CACHED_IMAGES) {
        this.cleanupOldestImages();
      }
    } catch (error) {
      console.error('Error caching image', error);
    }
  }

  /**
   * Cleanup expired images
   */
  private async cleanupExpiredImages() {
    const now = Date.now();
    const expiredUrls: string[] = [];
    
    // Find expired images
    this.cacheMap.forEach((cachedImage, url) => {
      if (cachedImage.expires < now) {
        expiredUrls.push(url);
      }
    });
    
    // Remove expired images
    for (const url of expiredUrls) {
      await this.removeFromCache(url);
    }
    
    if (expiredUrls.length > 0) {
      console.log(`Cleaned up ${expiredUrls.length} expired images from cache`);
    }
  }

  /**
   * Cleanup oldest images when cache is full
   */
  private async cleanupOldestImages() {
    // Sort cache entries by expiry date (oldest first)
    const sortedEntries = Array.from(this.cacheMap.entries())
      .sort((a, b) => a[1].expires - b[1].expires);
    
    // Remove oldest 20% of images
    const imagesToRemove = Math.ceil(this.MAX_CACHED_IMAGES * 0.2);
    const urlsToRemove = sortedEntries.slice(0, imagesToRemove).map(entry => entry[0]);
    
    for (const url of urlsToRemove) {
      await this.removeFromCache(url);
    }
    
    console.log(`Cleaned up ${urlsToRemove.length} oldest images from cache`);
  }

  /**
   * Remove an image from cache
   * @param url URL of the image to remove
   */
  private async removeFromCache(url: string): Promise<void> {
    try {
      // Remove from in-memory cache
      this.cacheMap.delete(url);
      
      // Remove from storage
      const storageKey = this.IMAGE_CACHE_PREFIX + this.hashUrl(url);
      await this.storage.remove(storageKey);
    } catch (error) {
      console.error('Error removing image from cache', error);
    }
  }

  /**
   * Get current cache statistics
   */
  async getCacheStats(): Promise<{size: number, totalImages: number}> {
    const totalImages = this.cacheMap.size;
    let totalSize = 0;
    
    this.cacheMap.forEach(cachedImage => {
      // Rough estimation of base64 size in bytes
      totalSize += cachedImage.base64.length * 0.75; // base64 is ~4/3 the size of binary
    });
    
    return {
      size: Math.round(totalSize / 1024 / 1024 * 100) / 100, // Size in MB with 2 decimal places
      totalImages
    };
  }

  /**
   * Clear the entire image cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await this.storage.keys();
      const imageCacheKeys = keys.filter(key => key.startsWith(this.IMAGE_CACHE_PREFIX));
      
      for (const key of imageCacheKeys) {
        await this.storage.remove(key);
      }
      
      // Clear in-memory cache
      this.cacheMap.clear();
      
      console.log('Image cache cleared');
    } catch (error) {
      console.error('Error clearing image cache', error);
      throw error;
    }
  }

  /**
   * Simple hash function for URLs
   * @param url URL to hash
   */
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16); // Convert to hex
  }
}