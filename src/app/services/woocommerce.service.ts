import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
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
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;
  
  // For demo purposes, if the API fails to connect
  private useDemo = false;
  
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  /**
   * Get all products with optional filters
   * @param options Query parameters to filter products
   */
  getProducts(options: any = {}): Observable<Product[]> {
    const params = this.createParams(options);
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(
        retry(2),
        catchError(error => {
          console.error('Error fetching products from API:', error);
          this.useDemo = true;
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
      params: this.createParams()
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
    
    return this.http.get<Category[]>(`${this.apiUrl}/products/categories`, { params })
      .pipe(
        retry(2),
        catchError(error => {
          console.error('Error fetching categories from API:', error);
          this.useDemo = true;
          return this.handleError('Failed to fetch categories', error);
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
      category: categoryId
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(
        retry(2),
        catchError(error => {
          console.error(`Error fetching products for category ${categoryId} from API:`, error);
          return this.handleError('Failed to fetch category products', error);
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
      per_page: limit
    });
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
    });
  }

  /**
   * Get on-sale products
   * @param limit Maximum number of products to return
   */
  getOnSaleProducts(limit: number = 10): Observable<Product[]> {
    return this.getProducts({
      on_sale: true,
      per_page: limit
    });
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
      params: this.createParams()
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
      params: this.createParams()
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
    const params = this.createParams({
      ...options,
      search: searchQuery
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(
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
      include: productIds.join(',')
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(
        retry(2),
        catchError(error => {
          console.error('Error fetching products by IDs:', error);
          return this.handleError('Failed to fetch products', error);
        })
      );
  }

  /**
   * Create parameters with authentication for WooCommerce API
   * @param additionalParams Additional query parameters
   */
  private createParams(additionalParams: any = {}): HttpParams {
    let params = new HttpParams()
      .set('consumer_key', this.consumerKey)
      .set('consumer_secret', this.consumerSecret);
    
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
  private handleError(message: string, error: HttpErrorResponse): Observable<never> {
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
    
    // Show error message to user
    this.presentToast(errorMessage);
    
    // If API connection fails, return demo data for better UX
    if (this.useDemo) {
      return throwError(() => new Error(errorMessage));
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