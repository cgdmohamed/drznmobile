import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { ToastController, ModalController, IonModal } from '@ionic/angular';
import { Product } from '../../interfaces/product.interface';
import { Category } from '../../interfaces/category.interface';
import { Subscription } from 'rxjs';
import { register } from 'swiper/element/bundle';

@Component({
  selector: 'app-category-products',
  templateUrl: './category-products.page.html',
  styleUrls: ['./category-products.page.scss'],
  standalone: false
})
export class CategoryProductsPage implements OnInit {
  categoryId: number;
  categoryName: string = '';
  products: Product[] = [];
  subcategories: Category[] = [];
  allCategories: Category[] = [];
  filters: any = {
    minPrice: 0,
    maxPrice: 5000,
    orderby: 'date', // default sort
    order: 'desc',   // default order
    onSale: false,   // filter for on-sale products
    inStock: false,  // filter for in-stock products
    brands: [],      // selected brands for filtering
  };
  availableBrands: any[] = [];
  isLoading = true;
  isLoadingMore = false; // New state for loading more products
  isFilterVisible = false;
  page: number = 1;
  totalPages: number = 1;
  private wishlistSubscription: Subscription;
  
  @ViewChild(IonModal) filterModal: IonModal;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private toastController: ToastController,
    private modalController: ModalController
  ) { 
    // Register Swiper web components
    register();
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.categoryId = +id;
        this.loadBrands(); // Load available brands first
        this.loadCategoryProducts();
        this.loadCategoryDetails();
      }
    });

    // Subscribe to wishlist changes
    this.wishlistSubscription = this.wishlistService.wishlist.subscribe(() => {
      // This will update the wishlist status of products
    });
  }
  
  // Load available brands for filtering
  loadBrands() {
    this.productService.getBrands().subscribe({
      next: (brands) => {
        // Initialize each brand with selected = false
        this.availableBrands = brands.map(brand => ({
          ...brand,
          selected: false
        }));
      },
      error: (error) => {
        console.error('Error fetching product brands from API:', error);
        // For testing purposes, use some sample brands
        this.availableBrands = [
          { id: 1, name: 'Apple', slug: 'apple', selected: false },
          { id: 2, name: 'Samsung', slug: 'samsung', selected: false },
          { id: 3, name: 'Sony', slug: 'sony', selected: false },
          { id: 4, name: 'LG', slug: 'lg', selected: false },
          { id: 5, name: 'Huawei', slug: 'huawei', selected: false }
        ];
      }
    });
  }

  ngOnDestroy() {
    if (this.wishlistSubscription) {
      this.wishlistSubscription.unsubscribe();
    }
  }

  loadCategoryDetails() {
    this.productService.getCategories().subscribe({
      next: (categories: Category[]) => {
        this.allCategories = categories;
        
        // Find the current category
        const category = categories.find(c => c.id === this.categoryId);
        if (category) {
          this.categoryName = category.name;
          
          // Find subcategories (categories whose parent is the current category)
          this.subcategories = categories.filter(c => c.parent === this.categoryId);
          
          // Load the max price for the price filter
          this.productService.getMaxPrice().subscribe(maxPrice => {
            this.filters.maxPrice = maxPrice;
          });
        }
      },
      error: (error) => {
        console.error('Error fetching category details:', error);
      }
    });
  }

  loadCategoryProducts(resetPage: boolean = true) {
    this.isLoading = true;
    
    // Reset page to 1 if loading initial products or applying new filters
    if (resetPage) {
      this.page = 1;
      this.products = []; // Clear existing products
    }
    
    // Apply the current filters with pagination
    const filterOptions = {
      orderby: this.filters.orderby,
      order: this.filters.order,
      minPrice: this.filters.minPrice,
      maxPrice: this.filters.maxPrice,
      onSale: this.filters.onSale,
      inStock: this.filters.inStock,
      brands: this.filters.brands, // Include brand filtering
      page: this.page,
      per_page: 20 // Number of products per page
    };
    
    this.productService.getProductsByCategory(this.categoryId, filterOptions).subscribe({
      next: (response: any) => {
        // Check if response has products and pagination info
        let products: Product[] = [];
        
        if (Array.isArray(response)) {
          // Direct array response
          products = response;
          // Estimate total pages if headers not available
          this.totalPages = products.length < 20 ? this.page : this.page + 1;
        } else if (response && response.products) {
          // Object response with pagination
          products = response.products;
          this.totalPages = response.totalPages || 1;
        }
        
        if (resetPage) {
          this.products = products;
        } else {
          // Append to existing products for infinite scroll
          this.products = [...this.products, ...products];
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching category products:', error);
        this.isLoading = false;
      }
    });
  }
  
  // Load more products when scrolling
  loadMore(event: any) {
    if (this.page >= this.totalPages) {
      event.target.complete();
      return;
    }
    
    this.isLoadingMore = true; // Show loading indicator
    this.page++;
    
    // Apply the current filters with pagination
    const filterOptions = {
      orderby: this.filters.orderby,
      order: this.filters.order,
      minPrice: this.filters.minPrice,
      maxPrice: this.filters.maxPrice,
      onSale: this.filters.onSale,
      inStock: this.filters.inStock,
      brands: this.filters.brands,
      page: this.page,
      per_page: 20
    };
    
    this.productService.getProductsByCategory(this.categoryId, filterOptions).subscribe({
      next: (response: any) => {
        // Process the new products
        let newProducts: Product[] = [];
        
        if (Array.isArray(response)) {
          newProducts = response;
          this.totalPages = newProducts.length < 20 ? this.page : this.page + 1;
        } else if (response && response.products) {
          newProducts = response.products;
          this.totalPages = response.totalPages || 1;
        }
        
        // Append to existing products
        this.products = [...this.products, ...newProducts];
        
        // Hide loading indicator
        this.isLoadingMore = false;
        
        // Complete the infinite scroll
        event.target.complete();
      },
      error: (error) => {
        console.error('Error loading more products:', error);
        this.isLoadingMore = false;
        event.target.complete();
      }
    });
  }
  
  // Method to apply filters and reload products
  async applyFilters() {
    // Close the modal if it's open
    if (this.isFilterVisible && this.filterModal) {
      await this.filterModal.dismiss();
      this.isFilterVisible = false;
    }
    
    // Load products with new filters
    this.loadCategoryProducts();
    
    // Show brief confirmation toast
    await this.presentToast('تم تطبيق خيارات التصفية');
  }
  
  // Method to reset filters to default values
  async resetFilters() {
    this.filters = {
      minPrice: 0,
      maxPrice: 5000,
      orderby: 'date',
      order: 'desc',
      onSale: false,
      inStock: false,
      brands: []
    };
    
    // Reset all brand checkboxes
    if (this.availableBrands && this.availableBrands.length > 0) {
      this.availableBrands = this.availableBrands.map(brand => ({
        ...brand,
        selected: false
      }));
    }
    
    // Show confirmation toast
    await this.presentToast('تم إعادة تعيين خيارات التصفية');
  }
  
  // Method to toggle filter panel visibility (open/close modal)
  async toggleFilterPanel() {
    if (this.isFilterVisible) {
      // Close the modal
      if (this.filterModal) {
        await this.filterModal.dismiss();
      }
      this.isFilterVisible = false;
    } else {
      // Open the modal
      this.isFilterVisible = true;
      if (this.filterModal) {
        await this.filterModal.present();
      }
    }
  }
  
  // Handle modal dismiss event
  onModalDismiss() {
    this.isFilterVisible = false;
  }
  
  // Method to update brand filters from checkbox selections
  updateBrandFilters() {
    // Get IDs of selected brands from the availableBrands array
    this.filters.brands = this.availableBrands
      .filter(brand => brand.selected)
      .map(brand => brand.id.toString());
  }
  
  // Get brand name by ID for display in chips
  getBrandName(brandId: string): string {
    const brand = this.availableBrands.find(b => b.id.toString() === brandId);
    return brand ? brand.name : '';
  }
  
  // Remove a specific brand filter
  removeBrandFilter(brandId: string) {
    // Remove from filters.brands array
    this.filters.brands = this.filters.brands.filter(id => id !== brandId);
    
    // Update the checkbox state in availableBrands
    const brand = this.availableBrands.find(b => b.id.toString() === brandId);
    if (brand) {
      brand.selected = false;
    }
    
    // Reload products with updated filters
    this.applyFilters();
  }

  isProductInWishlist(productId: number): boolean {
    return this.wishlistService.isInWishlist(productId);
  }

  async onFavoriteChange(productId: number) {
    if (this.isProductInWishlist(productId)) {
      this.wishlistService.removeFromWishlist(productId);
      await this.presentToast('تم إزالة المنتج من المفضلة');
    } else {
      this.wishlistService.addToWishlist(productId);
      await this.presentToast('تم إضافة المنتج إلى المفضلة');
    }
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product);
    this.presentToast('تم إضافة المنتج إلى السلة');
  }

  doRefresh(event: any) {
    this.loadCategoryProducts();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 1500,
      position: 'bottom',
      cssClass: 'custom-toast filter-toast',
      color: 'primary',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}