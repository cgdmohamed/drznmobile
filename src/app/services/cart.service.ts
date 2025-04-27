import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Storage } from '@ionic/storage-angular';
import { ToastController } from '@ionic/angular';
import { switchMap, tap } from 'rxjs/operators';
import { Product } from '../interfaces/product.interface';
import { Cart, CartItem } from '../interfaces/cart.interface';
import { ShippingService, ShippingMethod } from './shipping.service';

export interface SelectedShippingMethod {
  zoneId: number;
  methodId: number;
  method: ShippingMethod;
}

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
  
  private _selectedShippingMethod = new BehaviorSubject<SelectedShippingMethod | null>(null);
  private readonly CART_STORAGE_KEY = 'shopping_cart';
  private readonly SHIPPING_METHOD_KEY = 'selected_shipping_method';
  
  constructor(
    private storage: Storage, 
    private toastController: ToastController,
    private shippingService: ShippingService
  ) {
    this.initialize();
  }
  
  /**
   * Initialize the cart service
   */
  async initialize() {
    // Ensure storage is created before loading cart
    await this.storage.create();
    
    // Load cart data
    await this.loadCart();
    
    // Load saved shipping method
    await this.loadSelectedShippingMethod();
  }
  
  /**
   * Get cart as an observable
   */
  get cart(): Observable<Cart> {
    return this._cart.asObservable();
  }
  
  /**
   * Get current value of cart
   */
  get cartValue(): Cart {
    return this._cart.getValue();
  }

  /**
   * Get selected shipping method as an observable
   */
  get selectedShippingMethod(): Observable<SelectedShippingMethod | null> {
    return this._selectedShippingMethod.asObservable();
  }
  
  /**
   * Get current value of selected shipping method
   */
  get selectedShippingMethodValue(): SelectedShippingMethod | null {
    return this._selectedShippingMethod.getValue();
  }

  /**
   * Get current count of items in cart
   */
  getCurrentItemCount(): number {
    return this.cartValue.itemCount;
  }
  
  /**
   * Load cart from storage
   */
  async loadCart() {
    try {
      const storedCart = await this.storage.get(this.CART_STORAGE_KEY);
      if (storedCart) {
        this._cart.next(storedCart);
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
    }
  }
  
  /**
   * Load selected shipping method from storage
   */
  async loadSelectedShippingMethod() {
    try {
      const storedMethod = await this.storage.get(this.SHIPPING_METHOD_KEY);
      if (storedMethod) {
        this._selectedShippingMethod.next(storedMethod);
        
        // Recalculate cart with the loaded shipping method
        this.updateCartWithShippingMethod(storedMethod);
      }
    } catch (error) {
      console.error('Error loading shipping method from storage:', error);
    }
  }
  
  /**
   * Save cart to storage
   */
  async saveCart() {
    try {
      await this.storage.set(this.CART_STORAGE_KEY, this.cartValue);
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  }
  
  /**
   * Save selected shipping method to storage
   */
  async saveSelectedShippingMethod() {
    try {
      await this.storage.set(this.SHIPPING_METHOD_KEY, this.selectedShippingMethodValue);
    } catch (error) {
      console.error('Error saving shipping method to storage:', error);
    }
  }
  
  /**
   * Add a product to the cart
   * @param product The product to add
   * @param quantity The quantity to add
   */
  addToCart(product: Product, quantity: number = 1) {
    const currentCart = this.cartValue;
    const existingItemIndex = currentCart.items.findIndex(item => item.product.id === product.id);
    
    if (existingItemIndex !== -1) {
      // Update quantity if product already in cart
      const updatedItems = [...currentCart.items];
      updatedItems[existingItemIndex].quantity += quantity;
      
      const updatedCart = {
        ...currentCart,
        items: updatedItems
      };
      
      this._cart.next(this.recalculateCart(updatedCart));
    } else {
      // Add new item to cart
      const newItem: CartItem = {
        product,
        quantity
      };
      
      const updatedCart = {
        ...currentCart,
        items: [...currentCart.items, newItem]
      };
      
      this._cart.next(this.recalculateCart(updatedCart));
    }
    
    this.saveCart();
    this.presentToast(`${product.name} added to cart`);
  }
  
  /**
   * Update the quantity of a product in the cart
   * @param productId The ID of the product
   * @param quantity The new quantity
   */
  updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      return this.removeFromCart(productId);
    }
    
    const currentCart = this.cartValue;
    const existingItemIndex = currentCart.items.findIndex(item => item.product.id === productId);
    
    if (existingItemIndex !== -1) {
      const updatedItems = [...currentCart.items];
      updatedItems[existingItemIndex].quantity = quantity;
      
      const updatedCart = {
        ...currentCart,
        items: updatedItems
      };
      
      this._cart.next(this.recalculateCart(updatedCart));
      this.saveCart();
    }
  }
  
  /**
   * Remove a product from the cart
   * @param productId The ID of the product to remove
   */
  removeFromCart(productId: number) {
    const currentCart = this.cartValue;
    const updatedItems = currentCart.items.filter(item => item.product.id !== productId);
    
    const updatedCart = {
      ...currentCart,
      items: updatedItems
    };
    
    this._cart.next(this.recalculateCart(updatedCart));
    this.saveCart();
  }
  
  /**
   * Clear the entire cart
   */
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
    
    // Also clear shipping method when clearing cart
    this._selectedShippingMethod.next(null);
    this.saveSelectedShippingMethod();
    
    this._cart.next(emptyCart);
    this.saveCart();
  }
  
  /**
   * Apply a promo code to the cart
   * @param code The promo code to apply
   */
  applyPromoCode(code: string) {
    // In a real app, you would validate the promo code with the server
    // For this example, we'll just apply a 10% discount
    const currentCart = this.cartValue;
    const discount = currentCart.subtotal * 0.1;
    
    const updatedCart = {
      ...currentCart,
      discount
    };
    
    this._cart.next(this.recalculateCart(updatedCart));
    this.saveCart();
    this.presentToast(`Promo code "${code}" applied`);
  }
  
  /**
   * Select a shipping method
   * @param zoneId The shipping zone ID
   * @param methodId The shipping method ID
   * @param method The full shipping method object
   */
  async selectShippingMethod(zoneId: number, methodId: number, method: ShippingMethod) {
    const selectedMethod: SelectedShippingMethod = {
      zoneId,
      methodId,
      method
    };
    
    this._selectedShippingMethod.next(selectedMethod);
    await this.saveSelectedShippingMethod();
    
    // Recalculate cart with the new shipping method
    await this.updateCartWithShippingMethod(selectedMethod);
    
    this.presentToast(`Shipping method updated to: ${method.title}`);
  }
  
  /**
   * Update cart with selected shipping method
   * @param shippingMethod The selected shipping method
   */
  private async updateCartWithShippingMethod(shippingMethod: SelectedShippingMethod) {
    const currentCart = this.cartValue;
    let shippingCost = 0;
    
    // If shipping method has a fixed cost, use it
    if (shippingMethod.method.cost) {
      shippingCost = parseFloat(shippingMethod.method.cost);
    } else {
      // Otherwise calculate it
      const items = currentCart.items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        weight: item.product.weight || '0'
      }));
      
      // Get shipping cost from service
      this.shippingService.calculateShipping(
        shippingMethod.zoneId, 
        shippingMethod.methodId, 
        items
      ).subscribe(cost => {
        shippingCost = cost;
        
        // Update cart with new shipping cost
        const updatedCart = {
          ...currentCart,
          shipping: shippingCost
        };
        
        this._cart.next(this.recalculateCart(updatedCart));
        this.saveCart();
      });
    }
  }
  
  /**
   * Recalculate cart totals
   * @param cart The cart to recalculate
   */
  private recalculateCart(cart: Cart): Cart {
    const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = cart.items.reduce((total, item) => 
      total + (parseFloat(item.product.price) * item.quantity), 0);
    
    // Apply VAT (15% in Saudi Arabia)
    const vatRate = 0.15;
    const vat = (subtotal - cart.discount) * vatRate;
    
    // Use the shipping cost from cart (which may have been set by shipping method)
    // or use default if none selected
    const shipping = cart.shipping > 0 ? cart.shipping : (cart.items.length > 0 ? 10 : 0);
    
    // Calculate total
    const total = subtotal - cart.discount + shipping + vat;
    
    const updatedCart: Cart = {
      ...cart,
      itemCount,
      subtotal,
      vat,
      shipping,
      total
    };
    
    return updatedCart;
  }
  
  /**
   * Present a toast message
   * @param message The message to display
   */
  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    
    await toast.present();
  }
}