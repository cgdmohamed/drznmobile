import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product } from '../interfaces/product.interface';
import { Category } from '../interfaces/category.interface';

/**
 * This service provides mock data for development and testing
 * It's used when the WooCommerce API is not available
 * 
 * NOTE: In production, this service should be replaced with actual API calls
 */
@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  
  constructor() { }
  
  /**
   * Get mock featured products
   */
  getFeaturedProducts(): Observable<Product[]> {
    return of(this.generateMockProducts(8, true));
  }
  
  /**
   * Get mock new products
   */
  getNewProducts(): Observable<Product[]> {
    return of(this.generateMockProducts(6));
  }
  
  /**
   * Get mock on-sale products
   */
  getOnSaleProducts(): Observable<Product[]> {
    return of(this.generateMockProducts(6, false, true));
  }
  
  /**
   * Get mock categories
   */
  getCategories(): Observable<Category[]> {
    return of(this.generateMockCategories());
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
            src: `https://picsum.photos/id/${Math.floor(Math.random() * 100) + 1}/500/500`,
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
          src: `https://picsum.photos/id/${i + 20}/300/300`,
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