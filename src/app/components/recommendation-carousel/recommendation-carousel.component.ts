import { Component, OnInit, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RecommendationService } from '../../services/recommendation.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../interfaces/product.interface';

@Component({
  selector: 'app-recommendation-carousel',
  templateUrl: './recommendation-carousel.component.html',
  styleUrls: ['./recommendation-carousel.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class RecommendationCarouselComponent implements OnInit {
  @Input() title: string = 'منتجات مقترحة لك';
  @Input() description: string = 'مبنية على تفضيلاتك السابقة';
  @Input() maxItems: number = 10;
  
  recommendations: Product[] = [];
  isLoading: boolean = true;
  error: string = '';
  
  slideOpts = {
    slidesPerView: 2.3,
    spaceBetween: 10,
    freeMode: true,
    breakpoints: {
      // when window width is >= 576px
      576: {
        slidesPerView: 3.3,
        spaceBetween: 10
      },
      // when window width is >= 768px
      768: {
        slidesPerView: 4.3,
        spaceBetween: 15
      },
      // when window width is >= 992px
      992: {
        slidesPerView: 5.3,
        spaceBetween: 20
      }
    }
  };

  constructor(
    private recommendationService: RecommendationService,
    private cartService: CartService,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadRecommendations();
  }

  /**
   * Load personalized product recommendations
   */
  loadRecommendations() {
    this.isLoading = true;
    this.error = '';
    
    this.recommendationService.getPersonalizedRecommendations(this.maxItems)
      .subscribe(
        (products) => {
          this.recommendations = products;
          this.isLoading = false;
        },
        (error) => {
          console.error('Error loading recommendations', error);
          this.error = 'حدث خطأ أثناء تحميل المنتجات المقترحة';
          this.isLoading = false;
        }
      );
  }

  /**
   * Navigate to product details
   */
  goToProduct(product: Product) {
    this.router.navigate(['/product', product.id]);
  }

  /**
   * Add product to cart
   */
  addToCart(event: Event, product: Product) {
    event.stopPropagation(); // Prevent navigation to product details
    this.cartService.addToCart(product, 1);
  }
}