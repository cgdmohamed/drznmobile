import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Storage } from '@ionic/storage-angular';
import { Cart, CartItem } from '../interfaces/cart.interface';
import { Product } from '../interfaces/product.interface';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private _cart = new BehaviorSubject<Cart>({
    items: [],
    itemCount: 0,
    subtotal: 0,
    discount: 0,
    shipping: 0,
    vat: 0,
    total: 0
  });

  constructor(private storage: Storage) {
    // Storage initialization is done in app.component.ts
  }

  // Initialize the service (called from app.component.ts)
  async initialize() {
    await this.loadCart();
    return true;
  }

  // Cart observable
  get cart(): Observable<Cart> {
    return this._cart.asObservable();
  }

  // Get current cart value
  get cartValue(): Cart {
    return this._cart.value;
  }

  // Load cart from storage
  async loadCart() {
    try {
      const cart = await this.storage.get('cart');
      if (cart) {
        this._cart.next(cart);
      }
    } catch (error) {
      console.error('Error loading cart from storage', error);
    }
  }

  // Save cart to storage
  async saveCart() {
    try {
      await this.storage.set('cart', this._cart.value);
    } catch (error) {
      console.error('Error saving cart to storage', error);
    }
  }

  // Add a product to the cart
  addToCart(product: Product, quantity: number = 1) {
    const currentCart = this._cart.value;
    const existingItemIndex = currentCart.items.findIndex(
      item => item.product.id === product.id
    );

    if (existingItemIndex > -1) {
      // Product already in cart, update quantity
      const updatedItems = [...currentCart.items];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + quantity
      };

      const updatedCart = {
        ...currentCart,
        items: updatedItems
      };

      this.recalculateCart(updatedCart);
    } else {
      // Product not in cart, add it
      const newItem: CartItem = {
        product,
        quantity
      };

      const updatedCart = {
        ...currentCart,
        items: [...currentCart.items, newItem]
      };

      this.recalculateCart(updatedCart);
    }

    this.saveCart();
  }

  // Update product quantity in cart
  updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    const currentCart = this._cart.value;
    const existingItemIndex = currentCart.items.findIndex(
      item => item.product.id === productId
    );

    if (existingItemIndex > -1) {
      const updatedItems = [...currentCart.items];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity
      };

      const updatedCart = {
        ...currentCart,
        items: updatedItems
      };

      this.recalculateCart(updatedCart);
      this.saveCart();
    }
  }

  // Remove a product from the cart
  removeFromCart(productId: number) {
    const currentCart = this._cart.value;
    const updatedItems = currentCart.items.filter(
      item => item.product.id !== productId
    );

    const updatedCart = {
      ...currentCart,
      items: updatedItems
    };

    this.recalculateCart(updatedCart);
    this.saveCart();
  }

  // Clear all items from cart
  clearCart() {
    const emptyCart: Cart = {
      items: [],
      itemCount: 0,
      subtotal: 0,
      discount: 0,
      shipping: 0,
      vat: 0,
      total: 0
    };

    this._cart.next(emptyCart);
    this.saveCart();
  }

  // Apply a promo code
  applyPromoCode(code: string) {
    const cart = this._cart.value;
    
    // In a real app, this would check against valid promo codes
    // For demo purposes, we'll just apply a fixed discount
    if (code === 'DISCOUNT10') {
      const updatedCart = {
        ...cart,
        discount: cart.subtotal * 0.1 // 10% discount
      };
      
      this.recalculateCart(updatedCart);
      this.saveCart();
      return { success: true, message: 'Discount applied successfully!' };
    }
    
    return { success: false, message: 'Invalid promo code' };
  }

  // Recalculate cart totals
  private recalculateCart(cart: Cart) {
    let itemCount = 0;
    let subtotal = 0;

    // Calculate item count and subtotal
    cart.items.forEach(item => {
      itemCount += item.quantity;
      
      if (item.product.on_sale) {
        subtotal += parseFloat(item.product.sale_price) * item.quantity;
      } else {
        subtotal += parseFloat(item.product.regular_price) * item.quantity;
      }
    });

    // Set default shipping
    const shipping = itemCount > 0 ? 30 : 0;
    
    // Calculate VAT (15% in Saudi Arabia)
    const vat = subtotal * 0.15;
    
    // Calculate total
    const total = subtotal - cart.discount + shipping + vat;

    // Update cart
    const updatedCart: Cart = {
      ...cart,
      itemCount,
      subtotal,
      shipping,
      vat,
      total
    };

    this._cart.next(updatedCart);
  }
}