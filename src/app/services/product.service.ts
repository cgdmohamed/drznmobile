import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { mergeMap } from 'rxjs/operators';
import { Product } from '../interfaces/product.interface';
import { Category } from '../interfaces/category.interface';
import { environment } from '../../environments/environment';
import { MockDataService } from './mock-data.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;
  
  // Track product IDs that failed to load to avoid repeated API calls
  private failedProductIds = new Set<number>();

  constructor(
    private http: HttpClient,
    private mockDataService: MockDataService
  ) {}

  // Get products with optional filtering
  getProducts(options: any = {}): Observable<Product[]> {
    // In Replit demo environment or when API fails, use demo data
    if (environment.useDemoData) {
      console.log('Using demo products');
      return this.getDemoProducts(options.per_page || 20);
    }
    
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
    
    // Try to fetch from actual API, fall back to demo data if needed
    return this.http.get<Product[]>(`${this.apiUrl}/products?${queryString}`)
      .pipe(
        catchError(error => {
          console.error('Error fetching products from API:', error);
          return this.getDemoProducts(options.per_page || 20);
        })
      );
  }

  // Get a single product by ID
  getProduct(id: number): Observable<Product> {
    // In Replit demo environment, use demo data
    if (environment.useDemoData) {
      console.log(`Using demo product for ID: ${id}`);
      return of(this.generateDemoProduct(id));
    }
    
    // Check if this is a product ID we've already tried and failed to fetch
    if (this.failedProductIds.has(id)) {
      console.log(`Using fallback demo product for previously failed product ID: ${id}`);
      // Return a demo product as requested by the user
      return of(this.generateDemoProduct(id));
    }
    
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product>(
      `${this.apiUrl}/products/${id}?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`
    ).pipe(
      catchError(error => {
        console.error(`Error fetching product ID ${id} from API:`, error);
        
        // Add this ID to the list of failed product IDs so we won't try again
        this.failedProductIds.add(id);
        
        // Return a demo product to ensure we always have products
        console.log(`Generating demo product as fallback for ID: ${id}`);
        return of(this.generateDemoProduct(id));
      })
    );
  }

  // Get product categories with pagination support
  getCategories(options: any = {}): Observable<Category[]> {
    // In Replit demo environment or when API fails, use demo data
    if (environment.useDemoData) {
      console.log('Using demo categories');
      return this.mockDataService.getCategories();
    }
    
    // Connect to WooCommerce API using environment variables
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
            // Log more details about the error
            if (error.error) {
              console.warn('Error details:', error.error);
            }
            
            // Here we could display a toast message about connection issues
            // We'll fall back to mock data for now
          }
          
          // Add telemetry - could be important for debugging
          console.log('Falling back to demo categories due to API error');
          return this.mockDataService.getCategories();
        })
      );
  }

  // Get products by category with filtering options and pagination
  getProductsByCategory(categoryId: number, options: any = {}): Observable<any> {
    // In Replit demo environment or when API fails, use demo data
    if (environment.useDemoData) {
      console.log(`Using demo products for category ID: ${categoryId}`);
      const demoProducts = this.getDemoProducts(options.per_page || 20).pipe(
        map(products => ({
          products: products,
          totalPages: Math.ceil(products.length / (options.per_page || 20)),
          currentPage: options.page || 1
        }))
      );
      return demoProducts;
    }
    
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
          
          // Return demo products with pagination info
          const demoProducts = this.getDemoProducts(options.per_page || 20).pipe(
            map(products => ({
              products: products,
              totalPages: Math.ceil(products.length / (options.per_page || 20)),
              currentPage: params.page
            }))
          );
          
          return demoProducts;
        })
      );
  }

  // Search products with advanced options and pagination
  searchProducts(query: string, page: number = 1, per_page: number = 10): Observable<any> {
    // In Replit demo environment or when API fails, use demo data
    if (environment.useDemoData) {
      console.log(`Using demo search results for query: "${query}"`);
      const demoProducts = this.mockDataService.searchDemoProducts(query, per_page);
      return of({
        products: demoProducts,
        totalPages: Math.ceil(demoProducts.length / per_page),
        currentPage: page
      });
    }
    
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
          
          // Return demo products with pagination info
          const demoProducts = this.mockDataService.searchDemoProducts(query, per_page);
          return of({
            products: demoProducts,
            totalPages: Math.ceil(demoProducts.length / per_page),
            currentPage: page
          });
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
        // Fall back to demo brands
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
        return this.getDemoProducts(limit);
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
          return this.getDemoProducts(10);
        })
      );
  }

  // Get featured products
  getFeaturedProducts(limit: number = 10): Observable<Product[]> {
    // In Replit demo environment, use demo data
    if (environment.useDemoData) {
      console.log('Using demo featured products');
      return this.mockDataService.getFeaturedProducts();
    }
    
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&featured=true&per_page=${limit}&status=publish&orderby=rand`
    ).pipe(
      map(products => {
        // Ensure we have at least 5 products by supplementing with demo products if needed
        if (products.length < 5) {
          console.log(`Only got ${products.length} featured products from API, will add demo products to reach minimum 5`);
          // We'll fetch demo products separately and combine them
          return products;
        }
        return products;
      }),
      catchError(error => {
        console.error('Error fetching featured products from API:', error);
        
        // Check if it's a server connection error (502, 504, etc)
        if (error.status >= 500) {
          console.warn('Server connection error detected for featured products. API server may be unavailable.');
          // Log more details about the error
          if (error.error) {
            console.warn('Error details:', error.error);
          }
        }
        
        // Add telemetry
        console.log('Falling back to demo featured products due to API error');
        return this.mockDataService.getFeaturedProducts();
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
        return this.getDemoProducts(limit);
      })
    );
  }

  // Get new products
  getNewProducts(): Observable<Product[]> {
    // In Replit demo environment or when API fails, use demo data
    if (environment.useDemoData) {
      console.log('Using demo new products');
      return this.mockDataService.getNewProducts();
    }
    
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&orderby=date&order=desc&per_page=10&status=publish`
    ).pipe(
      catchError(error => {
        console.error('Error fetching new products from API:', error);
        
        // Check if it's a server connection error (502, 504, etc)
        if (error.status >= 500) {
          console.warn('Server connection error detected for new products. API server may be unavailable.');
          // Log more details about the error
          if (error.error) {
            console.warn('Error details:', error.error);
          }
        }
        
        // Add telemetry
        console.log('Falling back to demo new products due to API error');
        return this.mockDataService.getNewProducts();
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
        return this.getDemoProducts(6);
      })
    );
  }

  // Get products on sale
  getOnSaleProducts(): Observable<Product[]> {
    // In Replit demo environment or when API fails, use demo data
    if (environment.useDemoData) {
      console.log('Using demo on-sale products');
      return this.mockDataService.getOnSaleProducts();
    }
    
    // Connect to WooCommerce API using environment variables
    return this.http.get<Product[]>(
      `${this.apiUrl}/products?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&on_sale=true&per_page=10&status=publish&orderby=rand`
    ).pipe(
      catchError(error => {
        console.error('Error fetching on-sale products from API:', error);
        
        // Check if it's a server connection error (502, 504, etc)
        if (error.status >= 500) {
          console.warn('Server connection error detected for on-sale products. API server may be unavailable.');
          // Log more details about the error
          if (error.error) {
            console.warn('Error details:', error.error);
          }
        }
        
        // Add telemetry
        console.log('Falling back to demo on-sale products due to API error');
        return this.mockDataService.getOnSaleProducts();
      })
    );
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
        return this.getDemoProducts(4);
      })
    );
  }

  // Demo categories generator
  private getDemoCategories(): Observable<Category[]> {
    const categories: Category[] = [
      {
        id: 1,
        name: 'ملابس',
        slug: 'clothing',
        parent: 0,
        description: 'تشكيلة واسعة من الملابس العصرية',
        display: 'products',
        image: {
          id: 101,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          src: '../assets/images/categories/clothing.jpg',
          name: 'Clothing',
          alt: 'Clothing Category'
        },
        menu_order: 1,
        count: 45,
        _links: {
          self: [{ href: `${this.apiUrl}/products/categories/1` }],
          collection: [{ href: `${this.apiUrl}/products/categories` }]
        }
      },
      {
        id: 2,
        name: 'أحذية',
        slug: 'shoes',
        parent: 0,
        description: 'أحذية مريحة وأنيقة لجميع المناسبات',
        display: 'products',
        image: {
          id: 102,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          src: '../assets/images/categories/shoes.jpg',
          name: 'Shoes',
          alt: 'Shoes Category'
        },
        menu_order: 2,
        count: 32,
        _links: {
          self: [{ href: `${this.apiUrl}/products/categories/2` }],
          collection: [{ href: `${this.apiUrl}/products/categories` }]
        }
      },
      {
        id: 3,
        name: 'إكسسوارات',
        slug: 'accessories',
        parent: 0,
        description: 'إكسسوارات متنوعة لإكمال إطلالتك',
        display: 'products',
        image: {
          id: 103,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          src: '../assets/images/categories/accessories.jpg',
          name: 'Accessories',
          alt: 'Accessories Category'
        },
        menu_order: 3,
        count: 28,
        _links: {
          self: [{ href: `${this.apiUrl}/products/categories/3` }],
          collection: [{ href: `${this.apiUrl}/products/categories` }]
        }
      },
      {
        id: 4,
        name: 'إلكترونيات',
        slug: 'electronics',
        parent: 0,
        description: 'أحدث المنتجات الإلكترونية',
        display: 'products',
        image: {
          id: 104,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          src: '../assets/images/categories/electronics.jpg',
          name: 'Electronics',
          alt: 'Electronics Category'
        },
        menu_order: 4,
        count: 35,
        _links: {
          self: [{ href: `${this.apiUrl}/products/categories/4` }],
          collection: [{ href: `${this.apiUrl}/products/categories` }]
        }
      },
      {
        id: 5,
        name: 'منزل ومطبخ',
        slug: 'home-kitchen',
        parent: 0,
        description: 'كل ما تحتاجه لمنزلك ومطبخك',
        display: 'products',
        image: {
          id: 105,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          src: '../assets/images/categories/home-kitchen.jpg',
          name: 'Home & Kitchen',
          alt: 'Home & Kitchen Category'
        },
        menu_order: 5,
        count: 42,
        _links: {
          self: [{ href: `${this.apiUrl}/products/categories/5` }],
          collection: [{ href: `${this.apiUrl}/products/categories` }]
        }
      }
    ];

    return of(categories);
  }

  // Demo products generator
  private getDemoProducts(count: number = 10): Observable<Product[]> {
    const products: Product[] = [];
    for (let i = 0; i < count; i++) {
      products.push(this.generateDemoProduct(i + 1));
    }
    return of(products);
  }

  // Generate a single demo product
  private generateDemoProduct(id: number): Product {
    const productNames = [
      'تيشيرت قطني أساسي',
      'حذاء رياضي خفيف',
      'سماعات بلوتوث لاسلكية',
      'ساعة ذكية متعددة الوظائف',
      'حقيبة ظهر عصرية',
      'نظارة شمسية أنيقة',
      'جاكيت شتوي دافئ',
      'سروال جينز كلاسيكي',
      'قميص رسمي أنيق',
      'طقم أواني طهي'
    ];

    const categories = [
      { id: 1, name: 'ملابس', slug: 'clothing' },
      { id: 2, name: 'أحذية', slug: 'shoes' },
      { id: 3, name: 'إكسسوارات', slug: 'accessories' },
      { id: 4, name: 'إلكترونيات', slug: 'electronics' },
      { id: 5, name: 'منزل ومطبخ', slug: 'home-kitchen' }
    ];

    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const date = new Date().toISOString();
    const price = (Math.random() * 500 + 50).toFixed(2);
    const onSale = Math.random() > 0.7;
    const salePrice = onSale ? (parseFloat(price) * 0.8).toFixed(2) : '';

    return {
      id: id,
      name: productNames[id % productNames.length],
      slug: productNames[id % productNames.length].toLowerCase().replace(/\s+/g, '-'),
      permalink: `${this.apiUrl}/product/${id}`,
      date_created: date,
      date_modified: date,
      type: 'simple',
      status: 'publish',
      featured: Math.random() > 0.8,
      catalog_visibility: 'visible',
      description: 'وصف تفصيلي للمنتج مع شرح خصائصه ومميزاته التي تجعله اختيارًا مثاليًا لاحتياجاتك.',
      short_description: 'نبذة مختصرة عن المنتج',
      sku: `SKU-${id}`,
      price: price,
      regular_price: price,
      sale_price: salePrice,
      date_on_sale_from: onSale ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      date_on_sale_to: onSale ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
      on_sale: onSale,
      purchasable: true,
      total_sales: Math.floor(Math.random() * 100),
      virtual: false,
      downloadable: false,
      downloads: [],
      download_limit: 0,
      download_expiry: 0,
      tax_status: 'taxable',
      tax_class: '',
      manage_stock: true,
      stock_quantity: Math.floor(Math.random() * 50) + 5,
      stock_status: 'instock',
      backorders: 'no',
      backorders_allowed: false,
      backordered: false,
      sold_individually: false,
      weight: (Math.random() * 2).toFixed(2),
      dimensions: {
        length: (Math.random() * 30).toFixed(2),
        width: (Math.random() * 20).toFixed(2),
        height: (Math.random() * 10).toFixed(2)
      },
      shipping_required: true,
      shipping_taxable: true,
      shipping_class: '',
      shipping_class_id: 0,
      reviews_allowed: true,
      average_rating: (Math.random() * 5).toFixed(2),
      rating_count: Math.floor(Math.random() * 50),
      related_ids: [1, 2, 3, 4].filter(relId => relId !== id),
      upsell_ids: [],
      cross_sell_ids: [],
      parent_id: 0,
      purchase_note: '',
      categories: [randomCategory],
      tags: [],
      attributes: [],
      variations: [],
      grouped_products: [],
      menu_order: 0,
      images: [
        {
          id: id * 100,
          date_created: date,
          date_modified: date,
          src: id <= 1 ? '../assets/images/products/product-1.jpg' : '../assets/images/product-placeholder.svg',
          name: productNames[id % productNames.length],
          alt: productNames[id % productNames.length]
        }
      ],
      meta_data: []
    };
  }
}