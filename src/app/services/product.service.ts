import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { mergeMap } from 'rxjs/operators';
import { Product } from '../interfaces/product.interface';
import { Category } from '../interfaces/category.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;
  
  // Track product IDs that failed to load to avoid repeated API calls
  private failedProductIds = new Set<number>();
  private randomProductCache: Product[] = [];

  constructor(
    private http: HttpClient
    // Removed dependency on MockDataService
  ) {}

  // Get products with optional filtering
  getProducts(options: any = {}): Observable<Product[]> {
    // Connect to WooCommerce API using environment variables
    const params = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
      per_page: options.per_page || 20,
      page: options.page || 1,
      ...options
    };
    const queryString = Object.keys(params)
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Try to fetch from actual API, fall back to random API products if needed
    return this.http.get<Product[]>(`${this.apiUrl}/products?${queryString}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching products from API:', error);
          return this.getRandomProducts(options.per_page || 20);
        })
      );
  }

  // Get a single product by ID
  getProduct(id: number): Observable<Product> {
    // Check if this is a product ID we've already tried and failed to fetch
    if (this.failedProductIds.has(id)) {
      console.log(`Getting random product for previously failed product ID: ${id}`);
      // Get a random API product instead of demo
      return this.getRandomProducts(1).pipe(
        map(products => products.length > 0 ? products[0] : this.generateProductFromScratch(id))
      );
    }
    
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product>(
      `${this.apiUrl}/products/${id}?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`
    ).pipe(
      catchError(error => {
        console.error(`Error fetching product ID ${id} from API:`, error);
        
        // Add this ID to the list of failed product IDs so we won't try again
        this.failedProductIds.add(id);
        
        // Return a random product from API instead of demo
        console.log(`Getting random API product for failed ID: ${id}`);
        return this.getRandomProducts(1).pipe(
          map(products => {
            if (products.length > 0) {
              return products[0];
            } else {
              // As absolute last resort, generate a placeholder
              return this.generateProductFromScratch(id);
            }
          })
        );
      })
    );
  }
  
  // Last resort - generate a placeholder product from scratch with minimal info
  private generateProductFromScratch(id: number): Product {
    return {
      id: id,
      name: 'Product #' + id,
      slug: 'product-' + id,
      permalink: '',
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      type: 'simple',
      status: 'publish',
      featured: false,
      catalog_visibility: 'visible',
      description: 'This is a placeholder product.',
      short_description: 'Placeholder product',
      sku: 'PROD-' + id,
      price: '99.99',
      regular_price: '99.99',
      sale_price: '',
      date_on_sale_from: null,
      date_on_sale_to: null,
      on_sale: false,
      purchasable: true,
      total_sales: 0,
      virtual: false,
      downloadable: false,
      downloads: [],
      download_limit: -1,
      download_expiry: -1,
      tax_status: 'taxable',
      tax_class: '',
      manage_stock: false,
      stock_quantity: null,
      stock_status: 'instock',
      backorders: 'no',
      backorders_allowed: false,
      backordered: false,
      sold_individually: false,
      weight: '',
      dimensions: {
        length: '',
        width: '',
        height: ''
      },
      shipping_required: true,
      shipping_taxable: true,
      shipping_class: '',
      shipping_class_id: 0,
      reviews_allowed: true,
      average_rating: '0',
      rating_count: 0,
      related_ids: [],
      upsell_ids: [],
      cross_sell_ids: [],
      parent_id: 0,
      purchase_note: '',
      categories: [
        {
          id: 1,
          name: 'Uncategorized',
          slug: 'uncategorized'
        }
      ],
      tags: [],
      attributes: [],
      variations: [],
      grouped_products: [],
      menu_order: 0,
      images: [
        {
          id: 0,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          src: 'assets/images/product-placeholder.svg',
          name: 'Placeholder',
          alt: 'Placeholder'
        }
      ],
      meta_data: []
    } as Product;
  }
  
  // Get random real products from API
  getRandomProducts(count: number = 5): Observable<Product[]> {
    // Always try to get real products, even in demo environment
    
    // Check cache first
    if (this.randomProductCache.length >= count) {
      console.log(`Got ${count} random products from cache`);
      return of(this.randomProductCache.slice(0, count));
    }
    
    // Get a larger number of products to ensure we have enough 
    // even after filtering out potential duplicates
    const fetchCount = Math.max(30, count * 2);
    
    // Try first with orderby=rand which is the preferred method
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&per_page=${fetchCount}&orderby=rand&status=publish`
    ).pipe(
      map(products => {
        console.log(`Got ${products.length} random products from API to use across all sections`);
        // Store in cache for future use
        this.randomProductCache = products;
        if (products.length >= count) {
          return products.slice(0, count);
        }
        return products;
      }),
      catchError(error => {
        console.error(`Error fetching random products with orderby=rand:`, error);
        
        // If rand fails, try getting products without the random ordering
        // Many WooCommerce implementations don't support orderby=rand
        return this.http.get<Product[]>(
          `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&per_page=${fetchCount}&status=publish`
        ).pipe(
          map(products => {
            console.log(`Got ${products.length} non-random products from API, will shuffle manually`);
            // Store in cache for future use
            this.randomProductCache = products;
            // Shuffle the products manually
            const shuffled = products.sort(() => 0.5 - Math.random());
            if (shuffled.length >= count) {
              return shuffled.slice(0, count);
            }
            return shuffled;
          }),
          catchError(secondError => {
            console.error(`Error fetching any products from API:`, secondError);
            
            // As an absolute last resort, create minimal placeholder products
            console.log(`Creating ${count} minimal placeholder products as last resort`);
            const placeholders: Product[] = [];
            for (let i = 0; i < count; i++) {
              placeholders.push(this.generateProductFromScratch(Math.floor(Math.random() * 1000) + 9000));
            }
            return of(placeholders);
          })
        );
      })
    );
  }

  // Get product categories with pagination support
  getCategories(options: any = {}): Observable<Category[]> {
    // Connect to WooCommerce API using environment variables, even in demo mode
    const params = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
      per_page: options.per_page || 20,
      page: options.page || 1,
      ...options
    };

    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    console.log(`Fetching categories, page: ${params.page}, per_page: ${params.per_page}`);
    
    return this.http.get<Category[]>(`${this.apiUrl}/products/categories?${queryString}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching categories from API:', error);
          
          // Check if it's a server connection error (502, 504, etc)
          if (error.status >= 500) {
            console.warn('Server connection error detected. API server may be unavailable.');
          }
          
          // Create minimum viable categories when API fails
          console.log('Creating minimal viable categories as API fallback');
          // Create default categories that most stores would have
          const fallbackCategories: Category[] = [
            this.createBasicCategory(1, 'ملابس', 'clothing'),
            this.createBasicCategory(2, 'إلكترونيات', 'electronics'),
            this.createBasicCategory(3, 'أحذية', 'shoes'),
            this.createBasicCategory(4, 'إكسسوارات', 'accessories'),
            this.createBasicCategory(5, 'منزل', 'home')
          ];
          return of(fallbackCategories);
        })
      );
  }

  // Get products by category with filtering options and pagination
  getProductsByCategory(categoryId: number, options: any = {}): Observable<any> {
    // Connect to WooCommerce API using environment variables
    const params: any = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
      category: categoryId,
      per_page: options.per_page || 20,
      page: options.page || 1
    };
    
    // Apply optional filters if provided
    if (options.orderby) {
      params.orderby = options.orderby; // e.g., date, price, popularity
    }
    
    if (options.order) {
      params.order = options.order; // asc or desc
    }
    
    if (options.minPrice !== undefined && options.maxPrice !== undefined) {
      params.min_price = options.minPrice;
      params.max_price = options.maxPrice;
    }
    
    if (options.onSale) {
      params.on_sale = true;
    }
    
    if (options.inStock) {
      params.stock_status = 'instock';
    }
    
    // Add brand filter if provided
    if (options.brands && options.brands.length > 0) {
      params.attribute = 'pa_brand'; // This is the brand attribute slug
      params.attribute_term = options.brands.join(','); // Comma-separated list of brand term IDs
    }
    
    // Add any additional options provided
    for (const key in options) {
      if (options.hasOwnProperty(key) && 
          !['per_page', 'page', 'orderby', 'order', 'minPrice', 'maxPrice', 'onSale', 'inStock', 'brands'].includes(key)) {
        params[key] = options[key];
      }
    }
    
    const queryString = Object.keys(params)
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return this.http.get<Product[]>(`${this.apiUrl}/products?${queryString}`, { observe: 'response' })
      .pipe(
        map(response => {
          const totalPages = response.headers.get('X-WP-TotalPages') ? 
            parseInt(response.headers.get('X-WP-TotalPages') || '1', 10) : 1;
          
          return {
            products: response.body || [],
            totalPages: totalPages,
            currentPage: params.page
          };
        }),
        catchError(error => {
          console.error(`Error fetching products for category ${categoryId} from API:`, error);
          
          // Return random API products with pagination info
          return this.getRandomProducts(options.per_page || 20).pipe(
            map(products => ({
              products: products,
              totalPages: 1,
              currentPage: params.page
            }))
          );
        })
      );
  }

  // Search products with advanced options and pagination
  searchProducts(query: string, page: number = 1, per_page: number = 10): Observable<any> {
    // Connect to WooCommerce API using environment variables
    const params = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
      search: query,
      per_page: per_page,
      page: page
    };
    
    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    console.log(`Searching products with query "${query}", page: ${page}, per_page: ${per_page}`);
    
    return this.http.get<Product[]>(`${this.apiUrl}/products?${queryString}`, { observe: 'response' })
      .pipe(
        map(response => {
          const totalPages = response.headers.get('X-WP-TotalPages') ? 
            parseInt(response.headers.get('X-WP-TotalPages') || '1', 10) : 1;
          
          return {
            products: response.body || [],
            totalPages: totalPages,
            currentPage: page
          };
        }),
        catchError(error => {
          console.error(`Error searching products with query "${query}" from API:`, error);
          
          // Return random products as search results
          return this.getRandomProducts(per_page).pipe(
            map(products => ({
              products,
              totalPages: 1,
              currentPage: page
            }))
          );
        })
      );
  }

  // Get product brands (product attributes)
  getBrands(): Observable<any[]> {
    // Get the brand attribute terms from WooCommerce
    // The attribute ID 2 represents the brand attribute ('الماركة') with slug 'pa_brand'
    return this.http.get<any[]>(
      `${this.apiUrl}/products/attributes/2/terms?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&per_page=100`
    ).pipe(
      catchError(error => {
        console.error('Error fetching product brands from API:', error);
        // Fall back to basic brands
        return of([
          { id: 1, name: 'داك', slug: 'dac', count: 15 },
          { id: 2, name: 'نايك', slug: 'nike', count: 15 },
          { id: 3, name: 'أديداس', slug: 'adidas', count: 12 },
          { id: 4, name: 'بوما', slug: 'puma', count: 8 },
          { id: 5, name: 'ريبوك', slug: 'reebok', count: 6 },
          { id: 6, name: 'أندر آرمور', slug: 'under-armour', count: 4 }
        ]);
      })
    );
  }
  
  // Get products filtered by brand
  getProductsByBrands(brands: string[], limit: number = 20): Observable<Product[]> {
    if (!brands || brands.length === 0) {
      return of([]);
    }
    
    // Create the attribute filter parameter
    // Format: attribute=pa_brand&attribute_term=123,456
    const attributeParam = 'pa_brand'; // This is the brand attribute slug
    const attributeTerms = brands.join(','); // Comma-separated list of brand term IDs
    
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&attribute=${attributeParam}&attribute_term=${attributeTerms}&per_page=${limit}`
    ).pipe(
      catchError(error => {
        console.error(`Error fetching products for brands ${attributeTerms} from API:`, error);
        return this.getRandomProducts(limit);
      })
    );
  }

  // Get filtered products
  getFilteredProducts(filters: any): Observable<Product[]> {
    // Connect to WooCommerce API using environment variables
    const params = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret,
      per_page: 20,
      ...filters
    };
    
    const queryString = Object.keys(params)
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return this.http.get<Product[]>(`${this.apiUrl}/products?${queryString}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching filtered products from API:', error);
          return this.getRandomProducts(10);
        })
      );
  }

  // Get featured products
  getFeaturedProducts(limit: number = 10): Observable<Product[]> {
    // Connect to WooCommerce API using environment variables, even in demo mode
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&featured=true&per_page=${limit}&status=publish&orderby=rand`
    ).pipe(
      catchError(error => {
        console.error('Error fetching featured products from API:', error);
        
        // Check if it's a server connection error (502, 504, etc)
        if (error.status >= 500) {
          console.warn('Server connection error detected for featured products. API server may be unavailable.');
        }
        
        // Fall back to random real products instead of demo
        console.log('Falling back to random real products for featured section');
        return this.getRandomProducts(limit);
      })
    );
  }
  
  // Get products by multiple categories
  getProductsByCategories(categoryIds: number[], limit: number = 10): Observable<Product[]> {
    if (!categoryIds || categoryIds.length === 0) {
      return of([]);
    }
    
    // Connect to WooCommerce API using environment variables
    // Join category IDs with commas for the API
    const categoryParam = categoryIds.join(',');
    
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&category=${categoryParam}&per_page=${limit}`
    ).pipe(
      catchError(error => {
        console.error(`Error fetching products for categories ${categoryParam} from API:`, error);
        // Fall back to random real products instead of demo
        console.log('Falling back to random real products for products by categories');
        return this.getRandomProducts(limit);
      })
    );
  }

  // Get new products
  getNewProducts(): Observable<Product[]> {
    // Connect to WooCommerce API using environment variables, even in demo mode
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&orderby=date&order=desc&per_page=10&status=publish`
    ).pipe(
      catchError(error => {
        console.error('Error fetching new products from API:', error);
        
        // Check if it's a server connection error (502, 504, etc)
        if (error.status >= 500) {
          console.warn('Server connection error detected for new products. API server may be unavailable.');
        }
        
        // Fall back to random real products instead of demo
        console.log('Falling back to random real products for new products section');
        return this.getRandomProducts(10);
      })
    );
  }

  // Get bestseller products
  getBestsellers(): Observable<Product[]> {
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&orderby=popularity&order=desc&per_page=10&status=publish`
    ).pipe(
      catchError(error => {
        console.error('Error fetching bestseller products from API:', error);
        // Fall back to random real products instead of demo
        console.log('Falling back to random real products for bestsellers section');
        return this.getRandomProducts(10);
      })
    );
  }

  // Get products on sale
  getOnSaleProducts(): Observable<Product[]> {
    // Connect to WooCommerce API using environment variables, even in demo mode
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&on_sale=true&per_page=10&status=publish&orderby=rand`
    ).pipe(
      catchError(error => {
        console.error('Error fetching on-sale products from API:', error);
        
        // Check if it's a server connection error (502, 504, etc)
        if (error.status >= 500) {
          console.warn('Server connection error detected for on-sale products. API server may be unavailable.');
        }
        
        // Fall back to random real products instead of demo
        console.log('Falling back to random real products for on-sale products section');
        return this.getRandomProducts(10);
      })
    );
  }
  
  // Helper method to create a basic category when API fails
  private createBasicCategory(id: number, name: string, slug: string): Category {
    const date = new Date().toISOString();
    return {
      id: id,
      name: name,
      slug: slug,
      parent: 0,
      description: `${name} - Basic category`,
      display: 'default',
      image: {
        id: id * 100,
        date_created: date,
        date_modified: date,
        src: `assets/images/categories/${slug}.jpg`,
        name: name,
        alt: `${name} Category`
      },
      menu_order: id,
      count: 10,
      _links: {
        self: [{ href: `${this.apiUrl}/products/categories/${id}` }],
        collection: [{ href: `${this.apiUrl}/products/categories` }]
      }
    };
  }
  
  // Get maximum price available in the store for filter sliders
  getMaxPrice(): Observable<number> {
    // In a real WooCommerce API, we might need to fetch this data differently
    // For now, we'll use a simple approach
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&orderby=price&order=desc&per_page=1`
    ).pipe(
      catchError(error => {
        console.error('Error fetching max price from API:', error);
        return of(1000); // Fallback max price
      }),
      map((products: Product[]) => {
        if (Array.isArray(products) && products.length > 0 && products[0].price) {
          return parseFloat(products[0].price);
        }
        return 1000; // Default max price if no products found
      })
    );
  }

  // Get related products
  getRelatedProducts(productId: number): Observable<Product[]> {
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product[]>(
      `${this.apiUrl}/products/${productId}/related?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&per_page=4&status=publish`
    ).pipe(
      catchError(error => {
        console.error(`Error fetching related products for product ID ${productId} from API:`, error);
        // Fall back to random real products instead of demo
        console.log('Falling back to random real products for related products section');
        return this.getRandomProducts(4);
      })
    );
  }
}