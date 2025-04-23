// TypeScript declarations are in a separate file to avoid duplicate declarations

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
import { demoProducts } from '../demo/demo-products';
import { demoCategories } from '../demo/demo-categories';

@Injectable({
  providedIn: 'root'
})
export class WoocommerceService {
  // Use local proxy to prevent CORS issues
  private apiUrl = '/wp-json/wc/v3';
  private consumerKey = 'ck_6255526889b609ea53066560b71fdc41da7b866f';
  private consumerSecret = 'cs_bf2088d5f696a0b9f364d6090c48e9b4343c11a3';
  
  // For demo purposes, if the API fails to connect or credentials are empty
  private useDemo = true; // Temporarily use demo data for Replit environment
  
  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastController: ToastController
  ) {
    console.log('WooCommerce service initialized');
    console.log('API URL:', this.apiUrl);
    console.log('Using demo mode:', this.useDemo);
  }

  /**
   * Get all products with optional filters
   * @param options Query parameters to filter products
   */
  getProducts(options: any = {}): Observable<Product[]> {
    // If in demo mode, return demo products directly
    if (this.useDemo) {
      console.log('Using demo products data');
      
      let filteredProducts = [...demoProducts];
      
      // Apply filters
      if (options.featured) {
        filteredProducts = filteredProducts.filter(p => p.featured);
      }
      
      if (options.on_sale) {
        filteredProducts = filteredProducts.filter(p => p.on_sale);
      }
      
      if (options.orderby === 'date' && options.order === 'desc') {
        filteredProducts = filteredProducts.sort((a, b) => 
          new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
        );
      }
      
      // Limit results if per_page is set
      if (options.per_page) {
        filteredProducts = filteredProducts.slice(0, parseInt(options.per_page));
      }
      
      return of(filteredProducts);
    }
    
    // Otherwise, call the API
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
    // If in demo mode, return demo product
    if (this.useDemo) {
      const product = demoProducts.find(p => p.id === productId);
      if (product) {
        return of(product);
      }
      // If product not found, return the first one
      return of(demoProducts[0]);
    }
    
    return this.http.get<Product>(`${this.apiUrl}/products/${productId}`, {
      params: this.createParams()
    }).pipe(
      retry(2),
      catchError(error => {
        console.error(`Error fetching product ID ${productId} from API:`, error);
        this.useDemo = true;
        return this.handleError('Failed to fetch product details', error);
      })
    );
  }

  /**
   * Get all product categories
   * @param options Query parameters to filter categories
   */
  getCategories(options: any = {}): Observable<Category[]> {
    // If in demo mode, return demo categories directly
    if (this.useDemo) {
      console.log('Using demo categories data');
      return of(demoCategories);
    }
    
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
    // If in demo mode, filter demo products by category
    if (this.useDemo) {
      console.log(`Using demo products for category ${categoryId}`);
      
      const filteredProducts = demoProducts.filter(product => 
        product.categories.some(category => category.id === categoryId)
      );
      
      // Apply additional filters
      let result = [...filteredProducts];
      
      // Limit results if per_page is set
      if (options.per_page) {
        result = result.slice(0, parseInt(options.per_page));
      }
      
      return of(result);
    }
    
    const params = this.createParams({
      ...options,
      category: categoryId
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(
        retry(2),
        catchError(error => {
          console.error(`Error fetching products for category ${categoryId} from API:`, error);
          this.useDemo = true;
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
    // If in demo mode, do a simple search on product names/descriptions
    if (this.useDemo) {
      console.log(`Using demo products for search: "${searchQuery}"`);
      
      const searchTerms = searchQuery.toLowerCase().split(' ');
      
      // Search in name, description, and short_description
      const filteredProducts = demoProducts.filter(product => {
        const searchText = [
          product.name,
          product.description,
          product.short_description
        ].join(' ').toLowerCase();
        
        // Match if any search term is found
        return searchTerms.some(term => searchText.includes(term));
      });
      
      // Apply additional filters
      let result = [...filteredProducts];
      
      // Limit results if per_page is set
      if (options.per_page) {
        result = result.slice(0, parseInt(options.per_page));
      }
      
      return of(result);
    }
    
    const params = this.createParams({
      ...options,
      search: searchQuery
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(
        retry(2),
        catchError(error => {
          console.error(`Error searching for products with query "${searchQuery}":`, error);
          this.useDemo = true;
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
    
    // If in demo mode, filter by product IDs
    if (this.useDemo) {
      console.log(`Using demo products for IDs: ${productIds.join(', ')}`);
      
      const filteredProducts = demoProducts.filter(product => 
        productIds.includes(product.id)
      );
      
      return of(filteredProducts);
    }
    
    const params = this.createParams({
      include: productIds.join(',')
    });
    
    return this.http.get<Product[]>(`${this.apiUrl}/products`, { params })
      .pipe(
        retry(2),
        catchError(error => {
          console.error('Error fetching products by IDs:', error);
          this.useDemo = true;
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
    
    console.log('API Error:', errorMessage, 'Using demo data instead');
    
    // If API connection fails, return demo data for better UX
    if (this.useDemo) {
      // Return appropriate demo data based on the request
      if (message.includes('products')) {
        if (message.includes('categories')) {
          return of(demoCategories);
        }
        if (message.includes('featured')) {
          return of(demoProducts.filter(p => p.featured));
        }
        if (message.includes('on-sale')) {
          return of(demoProducts.filter(p => p.on_sale));
        }
        if (message.includes('category')) {
          // For category products, just return demo products as we don't have the category ID here
          return of(demoProducts);
        }
        // Default to all products
        return of(demoProducts);
      }
      
      // For other requests, return empty data
      return of([]);
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