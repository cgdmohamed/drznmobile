import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { Product } from '../../interfaces/product.interface';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-search-results',
  templateUrl: './search-results.page.html',
  styleUrls: ['./search-results.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SearchResultsPage implements OnInit {
  searchTerm: string = '';
  searchResults: Product[] = [];
  isLoading: boolean = true;
  isLoadingMore: boolean = false;
  noResults: boolean = false;
  page: number = 1;
  totalPages: number = 1;
  
  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['query']) {
        this.searchTerm = params['query'];
        this.performSearch();
      } else {
        this.noResults = true;
        this.isLoading = false;
      }
    });
  }

  performSearch() {
    this.isLoading = true;
    this.page = 1;
    this.searchResults = [];
    
    this.productService.searchProducts(this.searchTerm, this.page).subscribe(
      (response) => {
        this.searchResults = response.products;
        this.totalPages = response.totalPages;
        this.noResults = response.products.length === 0;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error searching products:', error);
        this.isLoading = false;
        this.noResults = true;
      }
    );
  }

  loadMore(event: any) {
    if (this.page >= this.totalPages) {
      event.target.complete();
      return;
    }
    
    this.isLoadingMore = true;
    this.page++;
    
    this.productService.searchProducts(this.searchTerm, this.page).subscribe(
      (response) => {
        this.searchResults = [...this.searchResults, ...response.products];
        this.isLoadingMore = false;
        event.target.complete();
      },
      (error) => {
        console.error('Error loading more search results:', error);
        this.isLoadingMore = false;
        event.target.complete();
      }
    );
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product);
    this.presentToast('تمت إضافة المنتج إلى سلة التسوق');
  }

  toggleWishlist(productId: number) {
    if (this.isProductInWishlist(productId)) {
      this.wishlistService.removeFromWishlist(productId);
      this.presentToast('تمت إزالة المنتج من المفضلة');
    } else {
      this.wishlistService.addToWishlist(productId);
      this.presentToast('تمت إضافة المنتج إلى المفضلة');
    }
  }

  isProductInWishlist(productId: number): boolean {
    return this.wishlistService.isInWishlist(productId);
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    toast.present();
  }
}