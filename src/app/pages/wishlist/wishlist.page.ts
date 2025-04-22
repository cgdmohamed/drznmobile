import { Component, OnInit, OnDestroy } from '@angular/core';
import { Product } from '../../interfaces/product.interface';
import { WishlistService } from '../../services/wishlist.service';
import { CartService } from '../../services/cart.service';
import { ProductService } from '../../services/product.service';
import { ToastController } from '@ionic/angular';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-wishlist',
  templateUrl: './wishlist.page.html',
  styleUrls: ['./wishlist.page.scss'],
  standalone: false
})
export class WishlistPage implements OnInit, OnDestroy {
  wishlistItems: Product[] = [];
  wishlistProductIds: number[] = [];
  isLoading = true;
  private wishlistSubscription: Subscription;

  constructor(
    private wishlistService: WishlistService,
    private cartService: CartService,
    private productService: ProductService,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.loadWishlistProducts();
  }

  loadWishlistProducts() {
    this.isLoading = true;
    this.wishlistSubscription = this.wishlistService.wishlist.pipe(
      switchMap(productIds => {
        this.wishlistProductIds = productIds;
        
        if (productIds.length === 0) {
          return of([]);
        }
        
        // Create an array of observables for each product request
        const productRequests = productIds.map(id => 
          this.productService.getProduct(id).pipe(
            catchError(() => of(null)) // Handle errors for individual products
          )
        );
        
        return forkJoin(productRequests).pipe(
          map(products => products.filter(p => p !== null) as Product[])
        );
      })
    ).subscribe({
      next: (products) => {
        this.wishlistItems = products;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading wishlist products:', error);
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.wishlistSubscription) {
      this.wishlistSubscription.unsubscribe();
    }
  }

  removeFromWishlist(productId: number) {
    this.wishlistService.removeFromWishlist(productId);
    this.presentToast('تم إزالة المنتج من المفضلة');
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product, 1);
    this.presentToast('تم إضافة المنتج إلى السلة');
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      cssClass: 'custom-toast'
    });
    await toast.present();
  }
}