import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product } from '../interfaces/product.interface';
import { Category } from '../interfaces/category.interface';
import { environment } from '../../environments/environment';

/**
 * This service provides mock data for development and testing
 * It's used when the WooCommerce API is not available
 * 
 * NOTE: In production, this service should always return empty arrays
 */
@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  
  constructor() {
    // Log warning if this service is instantiated in production
    if (environment.production) {
      console.warn('MockDataService should not be used in production. All methods will return empty arrays.');
    }
  }
  
  /**
   * Get mock featured products (empty array in production)
   */
  getFeaturedProducts(): Observable<Product[]> {
    if (environment.production) {
      console.log('MockDataService: getFeaturedProducts called in production - returning empty array');
      return of([]);
    }
    return of(this.generateMockProducts(8, true));
  }
  
  /**
   * Get mock new products (empty array in production)
   */
  getNewProducts(): Observable<Product[]> {
    if (environment.production) {
      console.log('MockDataService: getNewProducts called in production - returning empty array');
      return of([]);
    }
    return of(this.generateMockProducts(6));
  }
  
  /**
   * Get mock on-sale products (empty array in production)
   */
  getOnSaleProducts(): Observable<Product[]> {
    if (environment.production) {
      console.log('MockDataService: getOnSaleProducts called in production - returning empty array');
      return of([]);
    }
    return of(this.generateMockProducts(6, false, true));
  }
  
  /**
   * Get mock categories (empty array in production)
   */
  getCategories(): Observable<Category[]> {
    if (environment.production) {
      console.log('MockDataService: getCategories called in production - returning empty array');
      return of([]);
    }
    return of(this.generateMockCategories());
  }
  
  /**
   * Search demo products by search term (empty array in production)
   * @param query Search query
   * @param limit Maximum number of products to return
   */
  searchDemoProducts(query: string, limit: number = 10): Product[] {
    if (environment.production) {
      console.log('MockDataService: searchDemoProducts called in production - returning empty array');
      return [];
    }
    
    // Generate a larger set of products to search through
    const allProducts = this.generateMockProducts(30);
    
    // If no query, return random products
    if (!query || query.trim() === '') {
      return allProducts.slice(0, limit);
    }
    
    // Search by matching query to product name or description
    const queryLower = query.toLowerCase();
    const matchedProducts = allProducts.filter(product => {
      return (
        product.name.toLowerCase().includes(queryLower) ||
        product.description.toLowerCase().includes(queryLower) ||
        product.short_description.toLowerCase().includes(queryLower)
      );
    });
    
    // Return up to the limit
    return matchedProducts.slice(0, limit);
  }
  
  /**
   * Generate mock products
   */
  private generateMockProducts(count: number, featured: boolean = false, onSale: boolean = false): Product[] {
    const products: Product[] = [];
    
    for (let i = 1; i <= count; i++) {
      const id = Math.floor(Math.random() * 1000) + 1;
      const price = Math.floor(Math.random() * 500) + 50;
      const salePrice = Math.floor(price * 0.8);
      
      products.push({
        id: id,
        name: `منتج عينة ${i}`,
        slug: `sample-product-${i}`,
        permalink: `https://example.com/product/${i}`,
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        type: 'simple',
        status: 'publish',
        featured: featured,
        catalog_visibility: 'visible',
        description: 'وصف تفصيلي للمنتج العينة.',
        short_description: 'وصف مختصر للمنتج العينة.',
        sku: `SKU-${id}`,
        price: onSale ? salePrice.toString() : price.toString(),
        regular_price: price.toString(),
        sale_price: onSale ? salePrice.toString() : '',
        date_on_sale_from: onSale ? new Date().toISOString() : null,
        date_on_sale_to: onSale ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
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
        stock_quantity: Math.floor(Math.random() * 50) + 10,
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
        average_rating: (Math.random() * 5).toFixed(2),
        rating_count: Math.floor(Math.random() * 50),
        related_ids: [],
        upsell_ids: [],
        cross_sell_ids: [],
        parent_id: 0,
        purchase_note: '',
        categories: [
          {
            id: Math.floor(Math.random() * 5) + 1,
            name: `فئة ${Math.floor(Math.random() * 5) + 1}`,
            slug: `category-${Math.floor(Math.random() * 5) + 1}`
          }
        ],
        tags: [],
        attributes: [],
        variations: [],
        grouped_products: [],
        menu_order: 0,
        images: [
          {
            id: id,
            date_created: new Date().toISOString(),
            date_modified: new Date().toISOString(),
            src: `assets/images/product-placeholder.svg`,
            name: `Product image ${i}`,
            alt: `Product image for product ${i}`
          }
        ],
        meta_data: []
      });
    }
    
    return products;
  }
  
  /**
   * Generate mock categories
   */
  private generateMockCategories(): Category[] {
    const categories: Category[] = [];
    
    const categoryNames = [
      'الأحذية',
      'الملابس',
      'الإكسسوارات',
      'الحقائب',
      'الساعات',
      'النظارات',
      'العطور',
      'الإلكترونيات'
    ];
    
    for (let i = 0; i < categoryNames.length; i++) {
      categories.push({
        id: i + 1,
        name: categoryNames[i],
        slug: `category-${i + 1}`,
        parent: 0,
        description: `وصف لفئة ${categoryNames[i]}`,
        display: 'default',
        image: {
          id: i + 100,
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          src: `assets/images/category-placeholder.svg`,
          name: `${categoryNames[i]} image`,
          alt: `Image for ${categoryNames[i]}`
        },
        menu_order: i,
        count: Math.floor(Math.random() * 50) + 10,
        _links: {
          self: [{ href: `https://example.com/wp-json/wc/v3/products/categories/${i + 1}` }],
          collection: [{ href: 'https://example.com/wp-json/wc/v3/products/categories' }]
        }
      });
    }
    
    return categories;
  }
}