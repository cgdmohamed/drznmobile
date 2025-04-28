// TypeScript declarations are in a separate file to avoid duplicate declarations

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, retry, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Product } from '../interfaces/product.interface';
import { Category } from '../interfaces/category.interface';
import { Order } from '../interfaces/order.interface';
import { AuthService } from './auth.service';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class WoocommerceService {
  // Use proxied API URL for security
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;

  // Basic auth headers for API requests with base64 encoded credentials
  private headers: HttpHeaders;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastController: ToastController
  ) {
    console.log('WooCommerce service initialized');
    console.log('API URL:', this.apiUrl);
    
    // Create basic auth headers with base64 encoded consumer key and secret
    const auth = btoa(`${this.consumerKey}:${this.consumerSecret}`);
    this.headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Authorization', `Basic ${auth}`);
  }

  /**
   * Get all products with optional filters
   * @param options Query parameters to filter products
   */
  getProducts(options: any = {}): Observable<Product[]> {
    // Add status=publish to ensure only published products are returned
    const params = this.createParams({
      ...options,
      status: 'publish'
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { 
      params,
      headers: this.headers
    }).pipe(
        retry(2),
        catchError(error => {
          console.error('Error fetching products from API:', error);
          return this.handleError('Failed to fetch products', error);
        })
      );
  }

  /**
   * Get a specific product by ID
   * @param productId The ID of the product to fetch
   */
  getProduct(productId: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${productId}`, {
      params: this.createParams(),
      headers: this.headers
    }).pipe(
      retry(2),
      catchError(error => {
        console.error(`Error fetching product ID ${productId} from API:`, error);
        return this.handleError('Failed to fetch product details', error);
      })
    );
  }

  /**
   * Get all product categories
   * @param options Query parameters to filter categories
   */
  getCategories(options: any = {}): Observable<Category[]> {
    const params = this.createParams(options);
    
    return this.http.get<Category[]>(`${this.apiUrl}/products/categories`, { 
      params,
      headers: this.headers 
    })
      .pipe(
        retry(2),
        catchError(error => {
          console.error('Error fetching categories from API:', error);
          // Create minimal viable categories as API fallback
          console.log('Creating minimal viable categories as API fallback');
          return of([
            this.createBasicCategory(1, 'جميع المنتجات', 'all-products')
          ]);
        })
      );
  }

  /**
   * Get products by category ID
   * @param categoryId The ID of the category
   * @param options Additional query parameters
   */
  getProductsByCategory(categoryId: number, options: any = {}): Observable<Product[]> {
    const params = this.createParams({
      ...options,
      category: categoryId,
      status: 'publish'
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { 
      params,
      headers: this.headers
    })
      .pipe(
        retry(2),
        catchError(error => {
          console.error(`Error fetching products for category ${categoryId} from API:`, error);
          console.log(`Falling back to random real products for products by categories`);
          
          // Fallback to getRandomProducts if category-specific request fails
          return this.getRandomProducts(options.per_page || 8);
        })
      );
  }

  /**
   * Get featured products
   * @param limit Maximum number of products to return
   */
  getFeaturedProducts(limit: number = 10): Observable<Product[]> {
    return this.getProducts({
      featured: true,
      per_page: limit,
      orderby: 'rand' // Get random featured products for variety
    }).pipe(
      catchError(error => {
        console.error('Error fetching featured products from API:', error);
        console.log('Falling back to random real products for featured section');
        
        // Fallback to getRandomProducts if featured products request fails
        return this.getRandomProducts(limit);
      })
    );
  }

  /**
   * Get new products (sorted by date)
   * @param limit Maximum number of products to return
   */
  getNewProducts(limit: number = 10): Observable<Product[]> {
    return this.getProducts({
      orderby: 'date',
      order: 'desc',
      per_page: limit
    }).pipe(
      catchError(error => {
        console.error('Error fetching new products from API:', error);
        console.log('Falling back to random real products for new products section');
        
        // Fallback to getRandomProducts if new products request fails
        return this.getRandomProducts(limit);
      })
    );
  }

  /**
   * Get on-sale products
   * @param limit Maximum number of products to return
   */
  getOnSaleProducts(limit: number = 10): Observable<Product[]> {
    return this.getProducts({
      on_sale: true,
      per_page: limit,
      orderby: 'rand' // Get random sale products for variety
    }).pipe(
      catchError(error => {
        console.error('Error fetching on-sale products from API:', error);
        console.log('Falling back to random real products for on-sale products section');
        
        // Fallback to getRandomProducts if on-sale products request fails
        return this.getRandomProducts(limit);
      })
    );
  }

  /**
   * Get random products - useful as a fallback
   * @param limit Maximum number of products to return
   */
  getRandomProducts(limit: number = 10): Observable<Product[]> {
    return this.getProducts({
      per_page: limit * 3, // Request more than needed
      orderby: 'rand',     // Random order
      status: 'publish'     // Published products only
    }).pipe(
      map(products => {
        if (products && products.length > 0) {
          return products.slice(0, limit); // Return only what we need
        }
        console.error('Error fetching any products from API:', {
          message: 'No products available from API'
        });
        console.log('Returning empty product array due to API errors');
        return [];
      }),
      catchError(error => {
        console.error('Error fetching random products with orderby=rand:', error);
        
        // Last resort - try without orderby=rand
        return this.getProducts({
          per_page: limit,
          status: 'publish'
        }).pipe(
          catchError(finalError => {
            console.error('Error fetching any products from API:', finalError);
            console.log('Returning empty product array due to API errors');
            return of([]);
          })
        );
      })
    );
  }

  /**
   * Create a new order
   * @param orderData The order data to submit
   */
  createOrder(orderData: any): Observable<Order> {
    // If user is logged in, add customer ID to order
    if (this.authService.isLoggedIn) {
      const user = this.authService.userValue;
      if (user) {
        orderData.customer_id = user.id;
      }
    }
    
    return this.http.post<Order>(`${this.apiUrl}/orders`, orderData, {
      params: this.createParams(),
      headers: this.headers
    }).pipe(
      catchError(error => {
        console.error('Error creating order:', error);
        return this.handleError('Failed to create order', error);
      })
    );
  }

  /**
   * Update an existing order
   * @param orderId The ID of the order to update
   * @param orderData The updated order data
   */
  updateOrder(orderId: number, orderData: any): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/orders/${orderId}`, orderData, {
      params: this.createParams(),
      headers: this.headers
    }).pipe(
      catchError(error => {
        console.error(`Error updating order ${orderId}:`, error);
        return this.handleError('Failed to update order', error);
      })
    );
  }

  /**
   * Search for products
   * @param searchQuery The search query
   * @param options Additional query parameters
   */
  searchProducts(searchQuery: string, options: any = {}): Observable<Product[]> {
    if (!searchQuery || searchQuery.trim() === '') {
      return of([]);
    }
    
    const params = this.createParams({
      ...options,
      search: searchQuery,
      status: 'publish'
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { 
      params,
      headers: this.headers
    }).pipe(
        retry(2),
        catchError(error => {
          console.error(`Error searching for products with query "${searchQuery}":`, error);
          return this.handleError('Failed to search products', error);
        })
      );
  }

  /**
   * Get products by IDs
   * @param productIds Array of product IDs
   */
  getProductsByIds(productIds: number[]): Observable<Product[]> {
    if (!productIds || productIds.length === 0) {
      return of([]);
    }
    
    const params = this.createParams({
      include: productIds.join(','),
      status: 'publish'
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { 
      params,
      headers: this.headers
    }).pipe(
        retry(2),
        catchError(error => {
          console.error('Error fetching products by IDs:', error);
          return of([]);
        })
      );
  }

  /**
   * Create a basic category object - used for fallback
   */
  private createBasicCategory(id: number, name: string, slug: string): Category {
    return {
      id,
      name,
      slug,
      parent: 0,
      description: '',
      display: 'default',
      image: {
        id: 0,
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        src: '',
        name: '',
        alt: ''
      },
      menu_order: 0,
      count: 0,
      _links: {
        self: [{ href: '' }],
        collection: [{ href: '' }]
      }
    };
  }

  /**
   * Create parameters for WooCommerce API
   * @param additionalParams Additional query parameters
   */
  private createParams(additionalParams: any = {}): HttpParams {
    let params = new HttpParams();
    
    // Add additional parameters
    Object.keys(additionalParams).forEach(key => {
      params = params.set(key, additionalParams[key]);
    });
    
    return params;
  }

  /**
   * Handle HTTP errors
   * @param message Error message to display
   * @param error The error response
   */
  private handleError(message: string, error: HttpErrorResponse): Observable<any> {
    let errorMessage = message;
    
    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.status) {
      // Server-side error with status code
      switch (error.status) {
        case 401:
          errorMessage = 'Unauthorized: Please check your API credentials';
          break;
        case 404:
          errorMessage = 'Resource not found';
          break;
        case 500:
          errorMessage = 'Server error: Please try again later';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.message}`;
      }
    }
    
    console.log('API Error:', errorMessage);
    
    // Return empty array for list requests or null for single item requests
    if (message.includes('products') || message.includes('categories')) {
      return of([]);
    } else if (message.includes('product details')) {
      return of(null);
    }
    
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Present a toast message
   * @param message The message to display
   */
  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    
    await toast.present();
  }
}