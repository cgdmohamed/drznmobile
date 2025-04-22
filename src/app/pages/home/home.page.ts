import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../interfaces/product.interface';
import { Category } from '../../interfaces/category.interface';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  featuredProducts: Product[] = [];
  onSaleProducts: Product[] = [];
  bestsellerProducts: Product[] = [];
  categories: Category[] = [];
  mainCategories: Category[] = [];
  isLoading: boolean = true;
  sliderOptions = {
    slidesPerView: 2.2,
    spaceBetween: 10,
    speed: 400
  };
  categoryOptions = {
    slidesPerView: 4.5,
    spaceBetween: 10,
    speed: 400
  };
  
  constructor(
    private productService: ProductService,
    private cartService: CartService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    
    // Get featured products
    this.productService.getFeaturedProducts().subscribe(
      (products) => {
        this.featuredProducts = products;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading featured products', error);
        this.isLoading = false;
      }
    );
    
    // Get on sale products
    this.productService.getOnSaleProducts().subscribe(
      (products) => {
        this.onSaleProducts = products;
      },
      (error) => {
        console.error('Error loading on sale products', error);
      }
    );
    
    // Get bestseller products
    this.productService.getBestsellers().subscribe(
      (products) => {
        this.bestsellerProducts = products;
      },
      (error) => {
        console.error('Error loading bestseller products', error);
      }
    );
    
    // Get categories
    this.productService.getCategories().subscribe(
      (categories) => {
        this.categories = categories;
        
        // Filter out main categories (parent = 0)
        this.mainCategories = categories.filter(category => category.parent === 0);
      },
      (error) => {
        console.error('Error loading categories', error);
      }
    );
  }

  doRefresh(event: any) {
    this.loadData();
    
    // Complete the refresh after 2 seconds
    setTimeout(() => {
      event.target.complete();
    }, 2000);
  }

  addToCart(product: Product) {
    this.cartService.addToCart(product, 1);
  }

  onFavoriteChange(productId: number) {
    console.log('Favorite changed for product', productId);
    // This would normally implement logic to save to a favorites service
  }
}
