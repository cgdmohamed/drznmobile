import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Product } from '../../interfaces/product.interface';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
  standalone: false
})
export class ProductCardComponent implements OnInit {
  @Input() product: Product;
  @Input() showAddToCart: boolean = true;
  @Output() favoriteChanged = new EventEmitter<number>();
  
  isFavorite: boolean = false;

  constructor(private cartService: CartService) { }

  ngOnInit() {}

  toggleFavorite() {
    this.isFavorite = !this.isFavorite;
    this.favoriteChanged.emit(this.product.id);
  }

  addToCart() {
    this.cartService.addToCart(this.product, 1);
  }

  getPrimaryImage(): string {
    if (this.product && this.product.images && this.product.images.length > 0) {
      return this.product.images[0].src;
    }
    return 'assets/images/product-placeholder.svg';
  }

  getDiscountPercentage(): number {
    if (this.product && this.product.on_sale) {
      const regularPrice = parseFloat(this.product.regular_price);
      const salePrice = parseFloat(this.product.sale_price);
      
      if (regularPrice > 0 && salePrice > 0) {
        return Math.round((1 - salePrice / regularPrice) * 100);
      }
    }
    return 0;
  }
}