import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule, LoadingController, ToastController, ActionSheetController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Product } from '../../interfaces/product.interface';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { ReviewService } from '../../services/review.service';
import { RecommendationService } from '../../services/recommendation.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

// Define a ProductReview interface
interface ProductReview {
  id: number;
  date_created: string;
  reviewer: string;
  reviewer_email: string;
  review: string;
  rating: number;
  verified: boolean;
}

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductDetailPage implements OnInit, OnDestroy {
  product: Product;
  relatedProducts: Product[] = [];
  featuredProducts: Product[] = [];
  reviews: ProductReview[] = [];
  productId: number;
  quantity: number = 1;
  isLoading: boolean = true;
  loadingFeaturedProducts: boolean = true;
  selectedImage: string = '';
  selectedVariantId: number = 0;
  selectedAttributes: any = {};
  averageRating: number = 0;
  wishlistSubscription: Subscription;
  isInWishlist: boolean = false;
  isRTL: boolean = document.dir === 'rtl';
  
  // Review form related properties
  reviewForm: FormGroup;
  isReviewModalOpen: boolean = false;
  reviewRating: number = 0;
  isSubmittingReview: boolean = false;
  
  // Product image slider options
  slideOpts = {
    initialSlide: 0,
    speed: 400,
    zoom: {
      maxRatio: 3,
    },
  };
  
  // Related products slider options
  relatedProductsSlideOpts = {
    slidesPerView: 2.2,
    spaceBetween: 10,
    freeMode: true,
    breakpoints: {
      // Mobile
      320: {
        slidesPerView: 2.2,
        spaceBetween: 10
      },
      // Tablet
      768: {
        slidesPerView: 3.2,
        spaceBetween: 15
      },
      // Desktop
      1024: {
        slidesPerView: 4.2,
        spaceBetween: 20
      }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private reviewService: ReviewService,
    private recommendationService: RecommendationService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) { }

  // Initialize review form
  private initReviewForm() {
    // Get user info if logged in
    let name = '';
    let email = '';
    
    if (this.authService.isLoggedIn && this.authService.userValue) {
      const user = this.authService.userValue;
      name = `${user.first_name} ${user.last_name}`.trim();
      email = user.email;
    }
    
    this.reviewForm = this.formBuilder.group({
      reviewer: [name, [Validators.required, Validators.minLength(3)]],
      email: [email, [Validators.required, Validators.email]],
      review: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit() {
    this.loadProduct();
    
    // Initialize review form
    this.initReviewForm();
    
    // Subscribe to wishlist changes
    this.wishlistSubscription = this.wishlistService.wishlist.subscribe(wishlist => {
      this.isInWishlist = this.productId ? wishlist.includes(this.productId) : false;
    });
  }
  
  ionViewDidEnter() {
    // Load featured products here to ensure productId is available
    this.loadFeaturedProducts();
  }
  
  ngOnDestroy() {
    if (this.wishlistSubscription) {
      this.wishlistSubscription.unsubscribe();
    }
  }

  // Load product details from API
  loadProduct() {
    this.isLoading = true;
    
    this.productId = +this.route.snapshot.paramMap.get('id');
    
    this.productService.getProduct(this.productId).subscribe(
      product => {
        this.product = product;
        this.selectedImage = product.images.length > 0 ? product.images[0].src : 'assets/images/product-placeholder.jpg';
        
        // Track this product view for recommendations
        this.trackProductView(product);
        
        // Load product reviews
        this.loadReviews();
        
        this.isLoading = false;
      },
      error => {
        console.error('Error loading product', error);
        this.isLoading = false;
        this.presentToast('حدث خطأ أثناء تحميل المنتج. الرجاء المحاولة مرة أخرى.');
      }
    );
  }

  // Load related products - Deprecated as we now use the recommendation component
  // This method is kept for reference but is no longer called
  loadRelatedProducts() {
    this.productService.getRelatedProducts(this.productId).subscribe(
      products => {
        this.relatedProducts = products.filter(p => p.id !== this.productId).slice(0, 10);
      },
      error => {
        console.error('Error loading related products', error);
      }
    );
  }

  // Load product reviews
  loadReviews() {
    this.reviewService.getProductReviews(this.productId).subscribe(
      reviews => {
        this.reviews = reviews;
        // Calculate average rating
        if (reviews.length > 0) {
          const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
          this.averageRating = sum / reviews.length;
        }
      },
      error => {
        console.error('Error loading reviews', error);
      }
    );
  }

  // Set selected image when thumbnail is clicked
  selectImage(imageSrc: string) {
    this.selectedImage = imageSrc;
  }

  // Handle attribute selection
  onAttributeSelect(attributeId: number, optionValue: string) {
    this.selectedAttributes[attributeId] = optionValue;
    this.findMatchingVariant();
  }

  // Find matching variant based on selected attributes
  findMatchingVariant() {
    // This would typically match selected attributes to available variants
    // For simplicity, just using the first variant
    if (this.product && this.product.variations && this.product.variations.length > 0) {
      this.selectedVariantId = this.product.variations[0];
    }
  }

  // Increment quantity
  incrementQuantity() {
    // If product has stock management and quantity would exceed available stock
    if (this.product.manage_stock && 
        this.product.stock_quantity !== null && 
        this.quantity >= this.product.stock_quantity) {
      this.presentToast(`الكمية المتوفرة في المخزون هي ${this.product.stock_quantity} قطعة فقط`);
      return;
    }
    
    // Set a reasonable maximum limit even if stock management is not enabled
    if (this.quantity >= 99) {
      this.presentToast('الحد الأقصى للكمية هو 99 قطعة');
      return;
    }
    
    this.quantity++;
  }

  // Decrement quantity
  decrementQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  // Add product to cart
  addToCart() {
    this.cartService.addToCart(this.product, this.quantity);
    this.presentToast('تمت إضافة المنتج إلى سلة التسوق');
  }

  // Toggle product in wishlist
  toggleWishlist() {
    if (this.isInWishlist) {
      this.wishlistService.removeFromWishlist(this.productId);
      this.presentToast('تمت إزالة المنتج من المفضلة');
    } else {
      this.wishlistService.addToWishlist(this.productId);
      this.presentToast('تمت إضافة المنتج إلى المفضلة');
    }
  }
  
  // Calculate discount percentage
  calculateDiscount(regularPrice: string, salePrice: string): number {
    const regular = parseFloat(regularPrice);
    const sale = parseFloat(salePrice);
    
    if (regular <= 0 || sale <= 0 || sale >= regular) {
      return 0;
    }
    
    const discount = ((regular - sale) / regular) * 100;
    return Math.round(discount);
  }

  // Buy now (add to cart and navigate to checkout)
  buyNow() {
    this.cartService.addToCart(this.product, this.quantity);
    // Navigate to cart page
    this.router.navigateByUrl('/cart');
  }

  // Present share options
  async presentShareOptions() {
    // Check if the Web Share API is available in the browser
    if (navigator.share) {
      try {
        // Try to use native sharing if available
        const productImage = this.product.images && this.product.images.length > 0 
          ? this.product.images[0].src 
          : '';
        
        await navigator.share({
          title: this.product.name,
          text: `${this.product.name} - ${this.product.price} ر.س.\n${this.product.short_description}`,
          url: window.location.href
        });
        
        // Track successful sharing
        console.log('Shared successfully using Web Share API');
        this.presentToast('تم مشاركة المنتج بنجاح');
      } catch (error) {
        console.error('Error sharing:', error);
        // Fall back to action sheet if Web Share API fails
        this.presentShareActionSheet();
      }
    } else {
      // Fall back to action sheet for browsers that don't support Web Share API
      this.presentShareActionSheet();
    }
  }

  // Present sharing options as an action sheet
  async presentShareActionSheet() {
    const actionSheet = await this.actionSheetController.create({
      header: 'مشاركة المنتج',
      buttons: [
        {
          text: 'واتساب',
          icon: 'logo-whatsapp',
          handler: () => {
            this.shareProduct('whatsapp');
          }
        },
        {
          text: 'فيسبوك',
          icon: 'logo-facebook',
          handler: () => {
            this.shareProduct('facebook');
          }
        },
        {
          text: 'تويتر',
          icon: 'logo-twitter',
          handler: () => {
            this.shareProduct('twitter');
          }
        },
        {
          text: 'انستجرام',
          icon: 'logo-instagram',
          handler: () => {
            this.shareProduct('instagram');
          }
        },
        {
          text: 'تلجرام',
          icon: 'paper-plane-outline',
          handler: () => {
            this.shareProduct('telegram');
          }
        },
        {
          text: 'نسخ الرابط',
          icon: 'copy-outline',
          handler: () => {
            this.copyShareLink();
          }
        },
        {
          text: 'إلغاء',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    
    await actionSheet.present();
  }

  // Share product function with enhanced options
  shareProduct(platform: string) {
    // Enhanced share implementation with proper description and formatting
    const productTitle = this.product.name;
    const productPrice = this.product.price + ' ر.س.';
    const shortDescription = this.product.short_description 
      ? this.stripHtmlTags(this.product.short_description).substring(0, 100) + '...'
      : '';
    
    const shareText = `${productTitle}\n${productPrice}\n${shortDescription}`;
    const shareUrl = window.location.href;
    
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`, '_blank');
        break;
      
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
        break;
      
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
        
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
        break;
        
      case 'instagram':
        // Instagram doesn't support direct sharing via URL, so we copy text and inform user
        this.copyShareText(shareText + '\n\n' + shareUrl);
        this.presentToast('تم نسخ النص. يمكنك الآن لصقه في انستجرام!');
        break;
        
      default:
        console.error('Unknown platform:', platform);
    }
  }
  
  // Helper method to copy share link to clipboard
  copyShareLink() {
    const shareUrl = window.location.href;
    this.copyToClipboard(shareUrl);
    this.presentToast('تم نسخ الرابط إلى الحافظة');
  }
  
  // Helper method to copy text to clipboard
  copyShareText(text: string) {
    this.copyToClipboard(text);
  }
  
  // General clipboard copy function
  copyToClipboard(text: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .catch(err => {
          console.error('Could not copy text: ', err);
          this.fallbackCopyToClipboard(text);
        });
    } else {
      this.fallbackCopyToClipboard(text);
    }
  }
  
  // Fallback copy method for browsers without clipboard API
  fallbackCopyToClipboard(text: string) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea invisible
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      this.presentToast('تم نسخ النص إلى الحافظة');
    } catch (err) {
      console.error('Fallback copy failed:', err);
      this.presentToast('فشل نسخ النص، حاول مرة أخرى');
    }
    
    document.body.removeChild(textArea);
  }
  
  // Helper to strip HTML tags from content
  stripHtmlTags(html: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  // Load featured products for the carousel
  loadFeaturedProducts() {
    this.loadingFeaturedProducts = true;
    
    // Get featured products (6 max)
    this.productService.getFeaturedProducts(6).subscribe(
      products => {
        // Filter out the current product if it happens to be in the list
        this.featuredProducts = products.filter(p => p.id !== this.productId);
        this.loadingFeaturedProducts = false;
      },
      error => {
        console.error('Error loading featured products:', error);
        this.loadingFeaturedProducts = false;
      }
    );
  }
  
  // Navigate to product detail page for a featured product
  goToProduct(productId: number) {
    // Only navigate if it's not the current product
    if (productId !== this.productId) {
      this.router.navigate(['/product', productId]);
    }
  }
  
  // Handle wishlist button click in the carousel
  onWishlistButtonClick(event: Event, productId: number) {
    // Stop event propagation to prevent navigation
    event.stopPropagation();
    
    // Toggle product in wishlist
    if (this.isProductInWishlist(productId)) {
      this.wishlistService.removeFromWishlist(productId);
      this.presentToast('تمت إزالة المنتج من المفضلة');
    } else {
      this.wishlistService.addToWishlist(productId);
      this.presentToast('تمت إضافة المنتج إلى المفضلة');
    }
  }
  
  // Check if product is in wishlist
  isProductInWishlist(productId: number): boolean {
    return this.wishlistService.isInWishlist(productId);
  }
  
  // Add to cart from the carousel
  addToCartFromCarousel(event: Event, product: Product) {
    // Stop event propagation to prevent navigation
    event.stopPropagation();
    
    // Add product to cart with quantity 1
    this.cartService.addToCart(product, 1);
    this.presentToast('تمت إضافة المنتج إلى سلة التسوق');
  }
  
  // Handle image errors
  handleImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = '../assets/images/product-placeholder.svg';
  }

  // Track product view for recommendations
  trackProductView(product: Product) {
    if (product) {
      // Use recommendation service to track this product view
      this.recommendationService.trackProductView(product);
      console.log(`Tracked view for product: ${product.name} (ID: ${product.id})`);
    }
  }

  // Show toast message
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  // Open review modal
  openReviewModal() {
    // Reset form and rating
    this.initReviewForm();
    this.reviewRating = 0;
    this.isSubmittingReview = false;
    this.isReviewModalOpen = true;
  }
  
  // Open review modal with pre-selected rating
  openReviewModalWithRating(rating: number) {
    this.initReviewForm();
    this.reviewRating = rating;
    this.isSubmittingReview = false;
    this.isReviewModalOpen = true;
  }

  // Close review modal
  closeReviewModal() {
    this.isReviewModalOpen = false;
  }

  // Set review rating
  setRating(rating: number) {
    this.reviewRating = rating;
  }
  
  // Calculate percentage for rating bar visualization
  getRatingPercentage(starLevel: number): number {
    if (!this.reviews || this.reviews.length === 0) {
      return 0;
    }
    
    // Count reviews with this rating
    const countWithRating = this.reviews.filter(review => Math.round(review.rating) === starLevel).length;
    
    // Calculate percentage
    return (countWithRating / this.reviews.length) * 100;
  }
  
  // Check if user is logged in
  isUserLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }
  
  // Get user's display name for review
  getUserName(): string {
    if (this.authService.isLoggedIn && this.authService.userValue) {
      const user = this.authService.userValue;
      const fullName = `${user.first_name} ${user.last_name}`.trim();
      return fullName || user.username;
    }
    return '';
  }

  // Submit review
  async submitReview() {
    if ((this.reviewForm.invalid && !this.isUserLoggedIn()) || 
        (this.isUserLoggedIn() && !this.reviewForm.get('review').valid) || 
        this.reviewRating === 0) {
      this.presentToast('يرجى ملء جميع الحقول المطلوبة وتقييم المنتج');
      return;
    }

    this.isSubmittingReview = true;

    // Prepare review data
    let reviewData: any = {
      product_id: this.productId,
      review: this.reviewForm.get('review').value,
      rating: this.reviewRating
    };

    // If user is logged in, use their account info
    if (this.isUserLoggedIn() && this.authService.userValue) {
      const user = this.authService.userValue;
      reviewData.reviewer = `${user.first_name} ${user.last_name}`.trim() || user.username;
      reviewData.reviewer_email = user.email;
    } else {
      // Otherwise use the form data
      reviewData.reviewer = this.reviewForm.get('reviewer').value;
      reviewData.reviewer_email = this.reviewForm.get('email').value;
    }

    try {
      const result = await this.reviewService.createReview(this.productId, reviewData).toPromise();
      
      // Add the new review to the reviews array
      this.reviews.unshift(result);
      
      // Recalculate average rating
      const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
      this.averageRating = sum / this.reviews.length;
      
      this.presentToast('تم إرسال التقييم بنجاح');
      this.closeReviewModal();
    } catch (error) {
      console.error('Error submitting review', error);
      this.presentToast('حدث خطأ أثناء إرسال التقييم. الرجاء المحاولة مرة أخرى.');
    } finally {
      this.isSubmittingReview = false;
    }
  }
}