import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { ProductService } from '../../services/product.service';
import { Product } from '../../interfaces/product.interface';
import { FilterModalComponent } from '../../components/filter-modal/filter-modal.component';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.page.html',
  styleUrls: ['./product-list.page.scss'],
})
export class ProductListPage implements OnInit {
  @ViewChild(CdkVirtualScrollViewport) viewport: CdkVirtualScrollViewport;
  
  products: Product[] = [];
  categoryId: number;
  categoryName: string = '';
  isLoading = true;
  currentFilters: any = {};
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  
  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private modalCtrl: ModalController,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.categoryId = +params['category'];
        this.loadProductsByCategory();
      } else if (params['search']) {
        this.loadProductsBySearch(params['search']);
      } else if (params['on_sale']) {
        this.loadOnSaleProducts();
      } else if (params['featured']) {
        this.loadFeaturedProducts();
      } else {
        this.loadAllProducts();
      }
      
      // Apply any other filter parameters
      const filterKeys = ['min_price', 'max_price', 'orderby', 'brand'];
      filterKeys.forEach(key => {
        if (params[key]) {
          this.currentFilters[key] = params[key];
        }
      });
    });
  }
  
  // Load all products (with pagination)
  loadAllProducts() {
    this.isLoading = true;
    this.categoryName = 'All Products';
    
    // Using larger page size for virtual scrolling
    const pageSize = 20;
    
    const options = {
      page: this.currentPage,
      per_page: pageSize,
      ...this.currentFilters
    };
    
    this.productService.getProducts(options).subscribe(
      (products) => {
        this.products = products;
        this.isLoading = false;
        
        // Allow time for the viewport to render, then check its size
        setTimeout(() => {
          if (this.viewport) {
            this.viewport.checkViewportSize();
            this.cdr.detectChanges();
          }
        }, 100);
      },
      (error) => {
        console.error('Error loading products', error);
        this.isLoading = false;
      }
    );
  }
  
  // Load products by category
  loadProductsByCategory() {
    this.isLoading = true;
    
    // Get the category name first
    this.productService.getCategories().subscribe(
      (categories) => {
        const category = categories.find(c => c.id === this.categoryId);
        if (category) {
          this.categoryName = category.name;
        }
      }
    );
    
    // Using larger page size for virtual scrolling
    const pageSize = 20;
    
    const options = {
      page: this.currentPage,
      per_page: pageSize,
      ...this.currentFilters
    };
    
    this.productService.getProductsByCategory(this.categoryId, options).subscribe(
      (products) => {
        this.products = products;
        this.isLoading = false;
        
        // Allow time for the viewport to render, then check its size
        setTimeout(() => {
          if (this.viewport) {
            this.viewport.checkViewportSize();
            this.cdr.detectChanges();
          }
        }, 100);
      },
      (error) => {
        console.error('Error loading products by category', error);
        this.isLoading = false;
      }
    );
  }
  
  // Load products by search term
  loadProductsBySearch(searchTerm: string) {
    this.isLoading = true;
    this.categoryName = `Search: ${searchTerm}`;
    
    this.productService.searchProducts(searchTerm).subscribe(
      (products) => {
        this.products = products;
        this.isLoading = false;
        
        // Allow time for the viewport to render, then check its size
        setTimeout(() => {
          if (this.viewport) {
            this.viewport.checkViewportSize();
            this.cdr.detectChanges();
          }
        }, 100);
      },
      (error) => {
        console.error('Error loading search results', error);
        this.isLoading = false;
      }
    );
  }
  
  // Load on sale products
  loadOnSaleProducts() {
    this.isLoading = true;
    this.categoryName = 'On Sale';
    
    // Using larger page size for virtual scrolling
    const pageSize = 20;
    
    const options = {
      page: this.currentPage,
      per_page: pageSize,
      on_sale: true,
      ...this.currentFilters
    };
    
    this.productService.getProducts(options).subscribe(
      (products) => {
        this.products = products;
        this.isLoading = false;
        
        // Allow time for the viewport to render, then check its size
        setTimeout(() => {
          if (this.viewport) {
            this.viewport.checkViewportSize();
            this.cdr.detectChanges();
          }
        }, 100);
      },
      (error) => {
        console.error('Error loading on sale products', error);
        this.isLoading = false;
      }
    );
  }
  
  // Load featured products
  loadFeaturedProducts() {
    this.isLoading = true;
    this.categoryName = 'Featured Products';
    
    this.productService.getFeaturedProducts().subscribe(
      (products) => {
        this.products = products;
        this.isLoading = false;
        
        // Allow time for the viewport to render, then check its size
        setTimeout(() => {
          if (this.viewport) {
            this.viewport.checkViewportSize();
            this.cdr.detectChanges();
          }
        }, 100);
      },
      (error) => {
        console.error('Error loading featured products', error);
        this.isLoading = false;
      }
    );
  }
  
  // Load the next page of products
  loadNextPage(event: any) {
    this.currentPage++;
    
    // Increase per_page size for virtual scrolling for better performance
    const pageSize = 20; // Larger page size for better virtual scrolling performance
    
    if (this.categoryId) {
      const options = {
        page: this.currentPage,
        per_page: pageSize,
        ...this.currentFilters
      };
      
      this.productService.getProductsByCategory(this.categoryId, options).subscribe(
        (products) => {
          // Append new products
          this.products = [...this.products, ...products];
          event.target.complete();
          
          // Force viewport to check for changes
          if (this.viewport) {
            this.viewport.checkViewportSize();
            this.cdr.detectChanges();
          }
          
          // Disable infinite scroll if no more products
          if (products.length === 0) {
            event.target.disabled = true;
          }
        },
        (error) => {
          console.error('Error loading more products', error);
          event.target.complete();
        }
      );
    } else {
      const options = {
        page: this.currentPage,
        per_page: pageSize,
        ...this.currentFilters
      };
      
      this.productService.getProducts(options).subscribe(
        (products) => {
          // Append new products
          this.products = [...this.products, ...products];
          event.target.complete();
          
          // Force viewport to check for changes
          if (this.viewport) {
            this.viewport.checkViewportSize();
            this.cdr.detectChanges();
          }
          
          // Disable infinite scroll if no more products
          if (products.length === 0) {
            event.target.disabled = true;
          }
        },
        (error) => {
          console.error('Error loading more products', error);
          event.target.complete();
        }
      );
    }
  }
  
  // Pull to refresh
  doRefresh(event: any) {
    this.currentPage = 1;
    
    if (this.categoryId) {
      this.loadProductsByCategory();
    } else {
      this.loadAllProducts();
    }
    
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
  
  // Open filter modal
  async openFilterModal() {
    const modal = await this.modalCtrl.create({
      component: FilterModalComponent,
      componentProps: {
        currentFilters: this.currentFilters
      },
      cssClass: 'filter-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    if (data) {
      this.currentFilters = data;
      this.currentPage = 1;
      
      // Reload products with new filters
      if (this.categoryId) {
        this.loadProductsByCategory();
      } else {
        this.loadAllProducts();
      }
    }
  }
  
  // Handle favorite button click
  onFavoriteChange(productId: number) {
    console.log('Favorite changed for product', productId);
    // This would normally implement logic to save to a wishlist service
  }
}