import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { JwtAuthService } from '../../services/jwt-auth.service';
import { ProductService } from '../../services/product.service';
import { Cart, CartItem } from '../../interfaces/cart.interface';
import { Product } from '../../interfaces/product.interface';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
})
export class CartPage implements OnInit, OnDestroy {
  cart: Cart;
  isLoading: boolean = true;
  promoCode: string = '';
  recommendedProducts: Product[] = [];
  private cartSubscription: Subscription;
  private recommendedSubscription: Subscription;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private productService: ProductService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.isLoading = true;
    
    this.cartSubscription = this.cartService.cart.subscribe(cart => {
      this.cart = cart;
      this.isLoading = false;
      this.loadRecommendedProducts();
    });
  }

  ngOnDestroy() {
    if (this.cartSubscription) {
      this.cartSubscription.unsubscribe();
    }
    
    if (this.recommendedSubscription) {
      this.recommendedSubscription.unsubscribe();
    }
  }
  
  /**
   * Load recommended products based on cart contents
   * In this implementation, we'll show featured products as recommendations
   */
  loadRecommendedProducts() {
    // For simplicity, we're loading featured products as recommendations
    // In a real app, these would be based on user behavior and cart contents
    this.recommendedSubscription = this.productService.getFeaturedProducts().subscribe(
      products => {
        // Filter out products that are already in the cart
        const cartProductIds = this.cart.items.map(item => item.product.id);
        this.recommendedProducts = products
          .filter(product => !cartProductIds.includes(product.id))
          .slice(0, 6); // Limit to 6 products
      },
      error => {
        console.error('Error loading recommended products', error);
      }
    );
  }
  
  /**
   * Navigate to product details page
   */
  goToProduct(product: Product) {
    this.router.navigate(['/product', product.id]);
  }
  
  /**
   * Quickly add a product to cart
   */
  quickAddToCart(product: Product) {
    this.cartService.addToCart(product, 1);
    this.presentToast(`تمت إضافة ${product.name} إلى سلة التسوق`);
  }

  // Update item quantity
  async updateQuantity(productId: number, quantity: number) {
    if (quantity < 1) {
      this.removeItem(productId);
      return;
    }
    
    this.cartService.updateQuantity(productId, quantity);
  }

  // Remove item from cart
  async removeItem(productId: number) {
    const alert = await this.alertController.create({
      header: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف هذا المنتج من سلة التسوق؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'حذف',
          handler: () => {
            this.cartService.removeFromCart(productId);
            this.presentToast('تم حذف المنتج من سلة التسوق');
          }
        }
      ]
    });

    await alert.present();
  }

  // Apply promo code
  async applyPromoCode() {
    if (!this.promoCode.trim()) {
      this.presentToast('يرجى إدخال رمز الخصم', 'danger');
      return;
    }
    
    const loading = await this.loadingController.create({
      message: 'جاري التحقق من الرمز...',
      spinner: 'crescent'
    });
    
    await loading.present();
    
    // Simulate API delay
    setTimeout(() => {
      loading.dismiss();
      
      // Check if promo code is valid (for demo purposes)
      if (this.promoCode.toLowerCase() === 'darzn10') {
        this.cartService.applyPromoCode(this.promoCode);
        this.presentToast('تم تطبيق رمز الخصم بنجاح', 'success');
      } else {
        this.presentToast('رمز الخصم غير صالح', 'danger');
      }
    }, 1000);
  }

  // Clear cart
  async clearCart() {
    const alert = await this.alertController.create({
      header: 'تفريغ السلة',
      message: 'هل أنت متأكد من تفريغ سلة التسوق بالكامل؟',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel'
        },
        {
          text: 'تفريغ',
          handler: () => {
            this.cartService.clearCart();
            this.presentToast('تم تفريغ سلة التسوق');
          }
        }
      ]
    });

    await alert.present();
  }

  // Proceed to checkout
  async proceedToCheckout() {
    // Check if user is authenticated with either JWT or legacy auth
    if (!this.jwtAuthService.isAuthenticated && !this.authService.isLoggedIn) {
      console.log('User not authenticated, showing login prompt');
      
      const alert = await this.alertController.create({
        header: 'تسجيل الدخول مطلوب',
        message: 'يرجى تسجيل الدخول للمتابعة إلى الدفع',
        buttons: [
          {
            text: 'إلغاء',
            role: 'cancel'
          },
          {
            text: 'تسجيل الدخول',
            handler: () => {
              this.router.navigate(['/login'], {
                queryParams: { returnUrl: '/checkout' }
              });
            }
          }
        ]
      });

      await alert.present();
      return;
    }
    
    console.log('User is authenticated:', 
      this.jwtAuthService.isAuthenticated ? 'via JWT' : 
      this.authService.isLoggedIn ? 'via legacy auth' : 'unknown method');
    
    // Proceed to checkout page
    this.router.navigate(['/checkout']);
  }

  // Continue shopping
  continueShopping() {
    this.router.navigate(['/home']);
  }

  // Show toast message
  async presentToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: color
    });
    
    await toast.present();
  }
  
  // Helper method to parse float values for the template
  parseFloat(value: string): number {
    return parseFloat(value);
  }
}