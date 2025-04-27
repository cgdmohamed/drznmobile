import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { Product } from '../interfaces/product.interface';
import { Category } from '../interfaces/category.interface';
import { ProductService } from '../services/product.service';
import { CartService } from '../services/cart.service';
import { WishlistService } from '../services/wishlist.service';
import { NotificationService } from '../services/notification.service';

// Required for Swiper
import { register } from 'swiper/element/bundle';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy, AfterViewInit {
  featuredProducts: Product[] = [];
  newProducts: Product[] = [];
  onSaleProducts: Product[] = [];
  categories: Category[] = [];
  isLoading = true;
  cartItemCount = 0;
  unreadNotificationCount = 0;
  private cartSubscription: Subscription;
  private wishlistSubscription: Subscription;
  private notificationSubscription: Subscription;

  // Slider options for banner
  slideOpts = {
    initialSlide: 0,
    speed: 400,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false
    },
    pagination: true,
    loop: true
  };

  // Slider options for categories horizontal scroll
  categorySlideOpts = {
    slidesPerView: 3.5,
    spaceBetween: 10,
    freeMode: true,
    breakpoints: {
      // when window width is >= 576px
      576: {
        slidesPerView: 4.5,
      },
      // when window width is >= 992px
      992: {
        slidesPerView: 6.5,
      }
    }
  };

  // Grid layout for products (2 columns)
  productSlideOpts = {
    slidesPerView: 2.2,
    spaceBetween: 10,
    freeMode: true,
    grid: {
      rows: 1,
      fill: 'row'
    },
    breakpoints: {
      // when window width is >= 576px
      576: {
        slidesPerView: 3.2,
      },
      // when window width is >= 992px
      992: {
        slidesPerView: 4.2,
      }
    }
  };

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private notificationService: NotificationService,
    private toastController: ToastController,
    private alertController: AlertController,
    private router: Router
  ) {
    this.cartSubscription = this.cartService.cart.subscribe(cart => {
      this.cartItemCount = cart.itemCount;
    });

    this.wishlistSubscription = this.wishlistService.wishlist.subscribe(() => {
      // Just trigger a refresh when wishlist changes
    });
    
    // Subscribe to notification count changes
    this.notificationSubscription = this.notificationService.unreadCount.subscribe(count => {
      this.unreadNotificationCount = count;
    });
  }
  
  // Navigate to notifications page
  navigateToNotifications() {
    console.log('Home component: calling notification service navigation method');
    // Use the centralized notification service navigation method
    this.notificationService.navigateToNotificationsPage();
  }

  // Show search prompt
  async showSearchPrompt() {
    const alert = await this.alertController.create({
      header: 'بحث',
      message: 'البحث عن منتجات',
      inputs: [
        {
          name: 'query',
          type: 'text',
          placeholder: 'أدخل كلمة البحث هنا'
        }
      ],
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'بحث',
          handler: (data) => {
            if (data.query && data.query.trim() !== '') {
              this.router.navigate(['/search-results'], { 
                queryParams: { query: data.query.trim() } 
              });
            }
          }
        }
      ],
      cssClass: 'search-alert'
    });

    await alert.present();
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    
    if (this.wishlistSubscription) {
      this.wishlistSubscription.unsubscribe();
    }
    
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }
  
  ngAfterViewInit() {
    // Register Swiper web components for other swiper elements in the app
    register();
  }

  // Load all data for the home page
  loadData() {
    this.isLoading = true;
    
    // Simulate a loading delay to demonstrate skeleton loading
    setTimeout(() => {
      // Get categories
      this.productService.getCategories().subscribe(
        (categories) => {
          this.categories = categories;
        },
        (error) => {
          console.error('Error loading categories', error);
        }
      );

      // Get featured products
      this.productService.getFeaturedProducts().subscribe(
        (products) => {
          this.featuredProducts = products;
          // Ensure we have at least 5 products
          this.ensureMinimumProducts(this.featuredProducts, 'featured');
        },
        (error) => {
          console.error('Error loading featured products', error);
          // On error, load at least 5 demo products
          this.loadDemoProducts('featured');
        }
      );

      // Get new products
      this.productService.getNewProducts().subscribe(
        (products) => {
          this.newProducts = products;
          // Ensure we have at least 5 products
          this.ensureMinimumProducts(this.newProducts, 'new');
        },
        (error) => {
          console.error('Error loading new products', error);
          // On error, load at least 5 demo products
          this.loadDemoProducts('new');
        }
      );

      // Get on sale products
      this.productService.getOnSaleProducts().subscribe(
        (products) => {
          this.onSaleProducts = products;
          // Ensure we have at least 5 products
          this.ensureMinimumProducts(this.onSaleProducts, 'sale');
          this.isLoading = false;
        },
        (error) => {
          console.error('Error loading sale products', error);
          // On error, load at least 5 demo products
          this.loadDemoProducts('sale');
          this.isLoading = false;
        }
      );
    }, 1500); // 1.5 second delay to show the skeleton loading effect
  }

  // Toggle wishlist status
  async onFavoriteChange(productId: number) {
    // Find the product in one of our lists
    const product = 
      this.featuredProducts.find(p => p.id === productId) ||
      this.newProducts.find(p => p.id === productId) ||
      this.onSaleProducts.find(p => p.id === productId);

    if (product) {
      // Toggle the product in the wishlist
      if (this.isProductInWishlist(productId)) {
        this.wishlistService.removeFromWishlist(productId);
        this.presentToast('تمت إزالة المنتج من المفضلة');
      } else {
        this.wishlistService.addToWishlist(productId);
        this.presentToast('تمت إضافة المنتج إلى المفضلة');
      }
    }
  }

  // Check if product is in wishlist
  isProductInWishlist(productId: number): boolean {
    return this.wishlistService.isInWishlist(productId);
  }

  // Add to cart
  addToCart(product: Product) {
    this.cartService.addToCart(product);
    this.presentToast('تمت إضافة المنتج إلى سلة التسوق');
  }

  // Handle pull to refresh
  doRefresh(event: any) {
    // Reset the loading state and arrays
    this.isLoading = true;
    this.categories = [];
    this.featuredProducts = [];
    this.newProducts = [];
    this.onSaleProducts = [];
    
    // Load data with skeleton loading
    this.loadData();
    
    // Complete the refresh after data is loaded
    setTimeout(() => {
      event.target.complete();
    }, 2000); // 2 seconds to allow for the simulated loading delay
  }

  // Show toast message
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    toast.present();
  }
  
  // Get product image URL with proper handling for Arabic text
  getProductImageUrl(product: any): string {
    try {
      // Check if product is a category with image
      if (product && product.src) {
        return product.src;
      }
      
      // Check if product has images
      if (product && product.images && product.images.length > 0) {
        return product.images[0].src;
      }
    } catch (error) {
      console.error('Error processing image URL', error);
    }
    
    // Return a fallback image if no product images available or error occurs
    return 'assets/images/product-placeholder.svg';
  }
  
  // Handle image load error
  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    
    // Set a fallback image
    imgElement.src = 'assets/images/product-placeholder.svg';
    
    // Log the error for debugging
    console.error('Image load error:', imgElement.src);
  }

  // Ensure minimum number of products in each section
  private ensureMinimumProducts(productList: Product[], type: 'featured' | 'new' | 'sale'): void {
    if (productList.length < 5) {
      console.log(`Only got ${productList.length} ${type} products, adding random products from API to reach minimum 5`);
      
      // Create a set of existing product IDs to avoid duplicates
      const existingIds = new Set(productList.map(p => p.id));
      
      // First try to get random real products from API
      this.productService.getProducts({
        per_page: 10,
        orderby: 'rand', // Get random products
        status: 'publish'
      }).subscribe(randomProducts => {
        // Filter out duplicates
        const uniqueRandomProducts = randomProducts.filter(p => !existingIds.has(p.id));
        
        if (uniqueRandomProducts.length > 0) {
          // Take only what we need to reach 5 products
          const productsToAdd = uniqueRandomProducts.slice(0, 5 - productList.length);
          
          // Add the random products to our list
          productList.push(...productsToAdd);
          console.log(`Added ${productsToAdd.length} random API products to ${type} products`);
        } else {
          // If we couldn't get unique random products, use demo products as fallback
          console.log(`No unique random products available for ${type}, falling back to demo products`);
          this.addDemoProductsToList(productList, type, existingIds);
        }
      }, error => {
        // If API call fails, fall back to demo products
        console.error(`Error fetching random products for ${type}:`, error);
        this.addDemoProductsToList(productList, type, existingIds);
      });
    }
  }
  
  // Helper method to add demo products when API calls fail
  private addDemoProductsToList(productList: Product[], type: 'featured' | 'new' | 'sale', existingIds: Set<number>): void {
    const mockDataService = this.productService['mockDataService'];
    
    if (type === 'featured') {
      mockDataService.getFeaturedProducts().subscribe(products => {
        const demoProducts = products.filter(p => !existingIds.has(p.id)).slice(0, 5 - productList.length);
        productList.push(...demoProducts);
        console.log(`Added ${demoProducts.length} demo products to ${type} products as fallback`);
      });
    } else if (type === 'new') {
      mockDataService.getNewProducts().subscribe(products => {
        const demoProducts = products.filter(p => !existingIds.has(p.id)).slice(0, 5 - productList.length);
        productList.push(...demoProducts);
        console.log(`Added ${demoProducts.length} demo products to ${type} products as fallback`);
      });
    } else if (type === 'sale') {
      mockDataService.getOnSaleProducts().subscribe(products => {
        const demoProducts = products.filter(p => !existingIds.has(p.id)).slice(0, 5 - productList.length);
        productList.push(...demoProducts);
        console.log(`Added ${demoProducts.length} demo products to ${type} products as fallback`);
      });
    }
  }

  // Load products when a specific API call fails
  private loadDemoProducts(type: 'featured' | 'new' | 'sale'): void {
    // First try to get random products from the API
    this.productService.getProducts({
      per_page: 5,
      orderby: 'rand',
      status: 'publish'
    }).subscribe(randomProducts => {
      console.log(`Got ${randomProducts.length} random products from API for ${type}`);
      
      if (randomProducts.length >= 5) {
        // We have enough products, use them
        if (type === 'featured') {
          this.featuredProducts = randomProducts.slice(0, 5);
        } else if (type === 'new') {
          this.newProducts = randomProducts.slice(0, 5);
        } else if (type === 'sale') {
          this.onSaleProducts = randomProducts.slice(0, 5);
        }
        console.log(`Used ${randomProducts.slice(0, 5).length} random API products for ${type}`);
      } else {
        // Not enough products from API, supplement with demo products
        this.loadFallbackDemoProducts(type, randomProducts);
      }
    }, error => {
      // If API call fails, use demo products
      console.error(`Error fetching random products for ${type}:`, error);
      this.loadFallbackDemoProducts(type, []);
    });
  }
  
  // Fallback to demo products when API doesn't provide enough products
  private loadFallbackDemoProducts(type: 'featured' | 'new' | 'sale', existingProducts: Product[]): void {
    const mockDataService = this.productService['mockDataService'];
    
    if (type === 'featured') {
      mockDataService.getFeaturedProducts().subscribe(demoProducts => {
        // If we already have some products, only add what we need to reach 5
        if (existingProducts.length > 0) {
          const neededCount = 5 - existingProducts.length;
          const productsToAdd = demoProducts.slice(0, neededCount);
          this.featuredProducts = [...existingProducts, ...productsToAdd];
          console.log(`Added ${productsToAdd.length} demo products to ${existingProducts.length} API products for ${type}`);
        } else {
          // Otherwise use all demo products
          this.featuredProducts = demoProducts.slice(0, 5);
          console.log(`Loaded ${this.featuredProducts.length} demo featured products as complete fallback`);
        }
      });
    } else if (type === 'new') {
      mockDataService.getNewProducts().subscribe(demoProducts => {
        if (existingProducts.length > 0) {
          const neededCount = 5 - existingProducts.length;
          const productsToAdd = demoProducts.slice(0, neededCount);
          this.newProducts = [...existingProducts, ...productsToAdd];
          console.log(`Added ${productsToAdd.length} demo products to ${existingProducts.length} API products for ${type}`);
        } else {
          this.newProducts = demoProducts.slice(0, 5);
          console.log(`Loaded ${this.newProducts.length} demo new products as complete fallback`);
        }
      });
    } else if (type === 'sale') {
      mockDataService.getOnSaleProducts().subscribe(demoProducts => {
        if (existingProducts.length > 0) {
          const neededCount = 5 - existingProducts.length;
          const productsToAdd = demoProducts.slice(0, neededCount);
          this.onSaleProducts = [...existingProducts, ...productsToAdd];
          console.log(`Added ${productsToAdd.length} demo products to ${existingProducts.length} API products for ${type}`);
        } else {
          this.onSaleProducts = demoProducts.slice(0, 5);
          console.log(`Loaded ${this.onSaleProducts.length} demo sale products as complete fallback`);
        }
      });
    }
  }
}