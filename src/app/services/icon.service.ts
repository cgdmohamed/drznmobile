import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Service for handling custom SVG icons
 *
 * This service loads SVG icons from assets and provides them as sanitized HTML
 * Supports different icon categories (tab, nav, action)
 */
@Injectable({
  providedIn: 'root'
})
export class IconService {
  private iconCache: Map<string, Observable<SafeHtml>> = new Map();
  
  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}
  
  /**
   * Get an icon from the specified category
   * @param category - The icon category (tab, nav, action)
   * @param name - The icon name without extension
   * @returns An observable with the sanitized SVG icon
   */
  getIcon(category: 'tab' | 'nav' | 'action', name: string): Observable<SafeHtml> {
    const key = `${category}:${name}`;
    
    if (!this.iconCache.has(key)) {
      this.iconCache.set(
        key,
        this.http
          .get(`assets/icons/${category}/${name}.svg`, { responseType: 'text' })
          .pipe(
            map(svg => this.sanitizer.bypassSecurityTrustHtml(svg)),
            shareReplay(1)
          )
      );
    }
    
    return this.iconCache.get(key) as Observable<SafeHtml>;
  }
  
  /**
   * Get a tab icon by name
   * @param name - The icon name without extension
   * @returns An observable with the sanitized SVG icon
   */
  getTabIcon(name: string): Observable<SafeHtml> {
    return this.getIcon('tab', name);
  }
  
  /**
   * Get a navigation icon by name
   * @param name - The icon name without extension
   * @returns An observable with the sanitized SVG icon
   */
  getNavIcon(name: string): Observable<SafeHtml> {
    return this.getIcon('nav', name);
  }
  
  /**
   * Get an action icon by name
   * @param name - The icon name without extension
   * @returns An observable with the sanitized SVG icon
   */
  getActionIcon(name: string): Observable<SafeHtml> {
    return this.getIcon('action', name);
  }
}