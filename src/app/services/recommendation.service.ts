import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Product } from '../interfaces/product.interface';
import { StorageService } from './storage.service';
import { ProductService } from './product.service';
import { environment } from '../../environments/environment';

/**
 * Service for handling personalized product recommendations
 * 
 * This service tracks user behavior and provides personalized product recommendations
 * based on browsing history, purchase history, and user preferences.
 */
@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private readonly BROWSING_HISTORY_KEY = 'user_browsing_history';
  private readonly VIEWED_CATEGORIES_KEY = 'user_viewed_categories';
  private readonly MAX_HISTORY_ITEMS = 50;
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private storage: StorageService,
    private productService: ProductService
  ) { }

  /**
   * Track a product view to improve future recommendations
   * @param product The product that was viewed
   */
  trackProductView(product: Product): void {
    this.addToBrowsingHistory(product);
    this.trackCategoryView(product);
  }

  /**
   * Add a product to the user's browsing history
   * @param product The product to add to history
   */
  private async addToBrowsingHistory(product: Product): Promise<void> {
    try {
      // Get existing history
      const history = await this.getBrowsingHistory();
      
      // Remove product if it already exists to avoid duplicates
      const filteredHistory = history.filter(item => item.id !== product.id);
      
      // Add the product to the beginning of the array (most recent)
      filteredHistory.unshift({
        id: product.id,
        name: product.name,
        timestamp: new Date().toISOString()
      });
      
      // Limit the history size
      const trimmedHistory = filteredHistory.slice(0, this.MAX_HISTORY_ITEMS);
      
      // Save updated history
      await this.storage.set(this.BROWSING_HISTORY_KEY, trimmedHistory);
    } catch (error) {
      console.error('Error adding product to browsing history', error);
    }
  }

  /**
   * Track category view to understand user preferences
   * @param product The product viewed (to extract category)
   */
  private async trackCategoryView(product: Product): Promise<void> {
    if (!product.categories || product.categories.length === 0) {
      return;
    }

    try {
      // Get existing category views
      const categoryViews = await this.getCategoryViews();
      
      // Update view count for each category of the product
      product.categories.forEach(category => {
        const existingCategory = categoryViews.find(c => c.id === category.id);
        
        if (existingCategory) {
          existingCategory.viewCount += 1;
          existingCategory.lastViewed = new Date().toISOString();
        } else {
          categoryViews.push({
            id: category.id,
            name: category.name,
            viewCount: 1,
            lastViewed: new Date().toISOString()
          });
        }
      });
      
      // Sort by view count (descending)
      categoryViews.sort((a, b) => b.viewCount - a.viewCount);
      
      // Save updated category views
      await this.storage.set(this.VIEWED_CATEGORIES_KEY, categoryViews);
    } catch (error) {
      console.error('Error tracking category view', error);
    }
  }

  /**
   * Get the user's browsing history
   * @returns Array of browsed products (basic info only)
   */
  private async getBrowsingHistory(): Promise<any[]> {
    const history = await this.storage.get(this.BROWSING_HISTORY_KEY);
    return history || [];
  }

  /**
   * Get the user's category view statistics
   * @returns Array of categories with view counts
   */
  private async getCategoryViews(): Promise<any[]> {
    const views = await this.storage.get(this.VIEWED_CATEGORIES_KEY);
    return views || [];
  }
  
  /**
   * Get recommendations based on the user's browsing history
   * @param limit Maximum number of recommendations
   * @returns Promise of products based on browsing history
   */
  private async getRecommendationsFromBrowsingHistory(limit: number): Promise<Product[]> {
    try {
      // Get browsing history
      const history = await this.getBrowsingHistory();
      
      if (!history || history.length === 0) {
        return [];
      }
      
      // Get product IDs from history (removing duplicates)
      const productIds = history.map(item => item.id);
      
      // Take only the requested number of products
      const limitedIds = productIds.slice(0, limit);
      
      // Create a promise that resolves when all product details are fetched
      const productPromises = limitedIds.map(id => 
        new Promise<Product>((resolve, reject) => {
          this.productService.getProduct(id).subscribe(
            product => resolve(product),
            error => reject(error)
          );
        })
      );
      
      // Wait for all product details to be fetched
      const products = await Promise.all(
        productPromises.map(p => p.catch(e => null))
      );
      
      // Filter out null values (failed requests) and return
      return products.filter(product => product !== null) as Product[];
    } catch (error) {
      console.error('Error getting recommendations from browsing history', error);
      return [];
    }
  }

  /**
   * Get personalized recommendations based on browsing history and preferences
   * @param limit Maximum number of recommendations to return
   * @returns Observable of recommended products
   */
  getPersonalizedRecommendations(limit: number = 10): Observable<Product[]> {
    // Enhanced recommendation strategy:
    // 1. Try to get products directly from browsing history first
    // 2. Then based on user's most viewed categories
    // 3. If neither is available, use popular/featured products

    return new Observable<Product[]>(observer => {
      // First attempt to get recommendations based on browsing history
      this.getRecommendationsFromBrowsingHistory(limit).then(async historyProducts => {
        if (historyProducts && historyProducts.length >= limit / 2) {
          // If we have at least half the requested number of products from history
          observer.next(historyProducts);
          observer.complete();
        } else {
          // If we don't have enough products from history, try category-based
          try {
            const categoryViews = await this.getCategoryViews();
            
            if (categoryViews.length > 0) {
              // Get top categories (max 3)
              const topCategories = categoryViews
                .slice(0, 3)
                .map(category => category.id);
              
              // Get recommendations based on top categories
              this.productService.getProductsByCategories(topCategories, limit)
                .subscribe({
                  next: (categoryBasedProducts) => {
                    // Combine with history products if any, ensuring no duplicates
                    if (historyProducts && historyProducts.length > 0) {
                      const combinedProducts = [...historyProducts];
                      
                      // Add category products that aren't in history products
                      categoryBasedProducts.forEach(product => {
                        if (!combinedProducts.some(p => p.id === product.id)) {
                          combinedProducts.push(product);
                        }
                      });
                      
                      // Limit to requested size
                      observer.next(combinedProducts.slice(0, limit));
                    } else {
                      observer.next(categoryBasedProducts);
                    }
                    observer.complete();
                  },
                  error: (error) => {
                    console.error('Error getting category-based recommendations, falling back to featured products', error);
                    this.productService.getFeaturedProducts(limit)
                      .subscribe({
                        next: (fallbackProducts) => {
                          observer.next(fallbackProducts);
                          observer.complete();
                        },
                        error: (fallbackError) => {
                          observer.error(fallbackError);
                        }
                      });
                  }
                });
            } else {
              // No category history, use fallback
              this.productService.getFeaturedProducts(limit)
                .subscribe({
                  next: (products) => {
                    observer.next(products);
                    observer.complete();
                  },
                  error: (error) => {
                    observer.error(error);
                  }
                });
            }
          } catch (error) {
            console.error('Error accessing recommendation data, using fallback recommendations', error);
            this.productService.getFeaturedProducts(limit)
              .subscribe({
                next: (products) => {
                  observer.next(products);
                  observer.complete();
                },
                error: (fallbackError) => {
                  observer.error(fallbackError);
                }
              });
          }
        }
      }).catch(error => {
        console.error('Error accessing browsing history, falling back to featured products', error);
        // Continue with featured products as a fallback
        this.productService.getFeaturedProducts(limit)
          .subscribe({
            next: (products) => {
              observer.next(products);
              observer.complete();
            },
            error: (fallbackError) => {
              observer.error(fallbackError);
            }
          });
      });
    });
  }
}