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
   * Get personalized recommendations based on browsing history and preferences
   * @param limit Maximum number of recommendations to return
   * @returns Observable of recommended products
   */
  getPersonalizedRecommendations(limit: number = 10): Observable<Product[]> {
    // We'll try to get recommendations in this order:
    // 1. Based on user's most viewed categories
    // 2. If no categories viewed, use popular/featured products

    return new Observable<Product[]>(observer => {
      this.getCategoryViews().then(categoryViews => {
        if (categoryViews.length > 0) {
          // Get top categories (max 3)
          const topCategories = categoryViews
            .slice(0, 3)
            .map(category => category.id);
          
          // Get recommendations based on top categories
          this.getRecommendationsByCategories(topCategories, limit)
            .subscribe(
              products => {
                observer.next(products);
                observer.complete();
              },
              error => {
                console.error('Error getting category-based recommendations, falling back to featured products', error);
                this.getFallbackRecommendations(limit)
                  .subscribe(
                    fallbackProducts => {
                      observer.next(fallbackProducts);
                      observer.complete();
                    },
                    fallbackError => {
                      observer.error(fallbackError);
                    }
                  );
              }
            );
        } else {
          // No category history, use fallback
          this.getFallbackRecommendations(limit)
            .subscribe(
              products => {
                observer.next(products);
                observer.complete();
              },
              error => {
                observer.error(error);
              }
            );
        }
      }).catch(error => {
        console.error('Error accessing category views, using fallback recommendations', error);
        this.getFallbackRecommendations(limit)
          .subscribe(
            products => {
              observer.next(products);
              observer.complete();
            },
            fallbackError => {
              observer.error(fallbackError);
            }
          );
      });
    });
  }

  /**
   * Get recommendations based on specific categories
   * @param categoryIds Array of category IDs
   * @param limit Maximum number of recommendations
   * @returns Observable of products in these categories
   */
  private getRecommendationsByCategories(categoryIds: number[], limit: number): Observable<Product[]> {
    if (!categoryIds || categoryIds.length === 0) {
      return throwError('No category IDs provided');
    }

    // Use the product service to get products by category
    return this.productService.getProductsByCategories(categoryIds, limit);
  }

  /**
   * Fallback recommendations when personalization data is not available
   * @param limit Maximum number of recommendations
   * @returns Observable of popular products
   */
  private getFallbackRecommendations(limit: number): Observable<Product[]> {
    // Default to featured products as fallback
    return this.productService.getFeaturedProducts(limit);
  }
}