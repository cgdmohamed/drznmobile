import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private _wishlist = new BehaviorSubject<number[]>([]);
  private storageKey = 'wishlist';

  constructor(private storage: Storage) {
    this.loadWishlist();
  }

  // Get wishlist as observable
  get wishlist(): Observable<number[]> {
    return this._wishlist.asObservable();
  }

  // Get current wishlist value
  get wishlistValue(): number[] {
    return this._wishlist.value;
  }

  // Load wishlist from storage
  async loadWishlist() {
    try {
      await this.storage.create();
      const wishlist = await this.storage.get(this.storageKey) || [];
      this._wishlist.next(wishlist);
    } catch (error) {
      console.error('Error loading wishlist from storage', error);
    }
  }

  // Save wishlist to storage
  async saveWishlist() {
    try {
      await this.storage.set(this.storageKey, this._wishlist.value);
    } catch (error) {
      console.error('Error saving wishlist to storage', error);
    }
  }

  // Add product to wishlist
  addToWishlist(productId: number) {
    const currentWishlist = [...this._wishlist.value];
    
    if (!currentWishlist.includes(productId)) {
      const updatedWishlist = [...currentWishlist, productId];
      this._wishlist.next(updatedWishlist);
      this.saveWishlist();
    }
  }

  // Remove product from wishlist
  removeFromWishlist(productId: number) {
    const currentWishlist = [...this._wishlist.value];
    const index = currentWishlist.indexOf(productId);
    
    if (index !== -1) {
      currentWishlist.splice(index, 1);
      this._wishlist.next(currentWishlist);
      this.saveWishlist();
    }
  }

  // Check if product is in wishlist
  isInWishlist(productId: number): boolean {
    return this._wishlist.value.includes(productId);
  }
  
  // Get the list of product IDs in the wishlist
  getWishlistItems(): number[] {
    return [...this._wishlist.value];
  }

  // Clear entire wishlist
  clearWishlist() {
    this._wishlist.next([]);
    this.saveWishlist();
  }
}