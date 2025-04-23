import { Component, OnInit, ViewChild } from '@angular/core';
import { IonSearchbar, ToastController } from '@ionic/angular';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { Product } from '../../interfaces/product.interface';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit {
  @ViewChild('searchBar', { static: false }) searchBar: IonSearchbar;
  
  searchTerm: string = '';
  searchTermChanged: Subject<string> = new Subject<string>();
  searchResults: Product[] = [];
  recentSearches: string[] = [];
  popularSearches: string[] = ['سماعات', 'ايفون', 'ساعة ذكية', 'بوربوينت', 'كيبورد'];
  isLoading: boolean = false;
  noResults: boolean = false;
  page: number = 1;
  totalPages: number = 1;
  private searchSubscription: Subscription;
  
  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private toastController: ToastController
  ) {
    // Set up search debounce to avoid too many API calls
    this.searchSubscription = this.searchTermChanged.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.performSearch(searchTerm);
    });
  }

  ngOnInit() {
    this.loadRecentSearches();
  }

  ionViewDidEnter() {
    // Focus the search bar when the page enters
    setTimeout(() => {
      this.searchBar?.setFocus();
    }, 300);
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onSearchInput(event: any) {
    const term = event.target.value.trim();
    this.searchTerm = term;
    if (term) {
      this.searchTermChanged.next(term);
    } else {
      this.searchResults = [];
      this.noResults = false;
    }
  }

  onClearSearch() {
    this.searchTerm = '';
    this.searchResults = [];
    this.noResults = false;
  }

  performSearch(term: string) {
    if (!term) return;
    
    this.isLoading = true;
    this.page = 1;
    
    this.productService.searchProducts(term, this.page).subscribe(
      (response) => {
        this.searchResults = response.products;
        this.totalPages = response.totalPages;
        this.noResults = response.products.length === 0;
        this.isLoading = false;
        
        // Save to recent searches if we got results
        if (response.products.length > 0) {
          this.addToRecentSearches(term);
        }
      },
      (error) => {
        console.error('Error searching products:', error);
        this.isLoading = false;
        this.noResults = true;
      }
    );
  }

  loadMoreResults(event: any) {
    if (this.page >= this.totalPages) {
      event.target.complete();
      return;
    }
    
    this.page++;
    
    this.productService.searchProducts(this.searchTerm, this.page).subscribe(
      (response) => {
        this.searchResults = [...this.searchResults, ...response.products];
        event.target.complete();
      },
      (error) => {
        console.error('Error loading more search results:', error);
        event.target.complete();
      }
    );
  }

  useSearchTerm(term: string) {
    this.searchTerm = term;
    this.searchBar.value = term;
    this.performSearch(term);
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

  // Load recent searches from local storage
  private loadRecentSearches() {
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      this.recentSearches = JSON.parse(savedSearches);
    }
  }

  // Add a term to recent searches, avoiding duplicates and limiting to 5 items
  private addToRecentSearches(term: string) {
    // Remove if already exists to avoid duplicates
    this.recentSearches = this.recentSearches.filter(search => search !== term);
    
    // Add to the beginning of the array
    this.recentSearches.unshift(term);
    
    // Limit to 5 most recent searches
    if (this.recentSearches.length > 5) {
      this.recentSearches = this.recentSearches.slice(0, 5);
    }
    
    // Save to localStorage
    localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
  }

  removeRecentSearch(term: string) {
    this.recentSearches = this.recentSearches.filter(search => search !== term);
    localStorage.setItem('recentSearches', JSON.stringify(this.recentSearches));
  }

  clearAllRecentSearches() {
    this.recentSearches = [];
    localStorage.removeItem('recentSearches');
  }
}