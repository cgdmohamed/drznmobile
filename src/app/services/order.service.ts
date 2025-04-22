import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Storage } from '@ionic/storage-angular';
import { Order } from '../interfaces/order.interface';
import { Cart } from '../interfaces/cart.interface';
import { ToastController } from '@ionic/angular';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;
  
  private _orders = new BehaviorSubject<Order[]>([]);
  private readonly ORDERS_STORAGE_KEY = 'user_orders';
  
  constructor(
    private http: HttpClient,
    private storage: Storage,
    private authService: AuthService,
    private toastController: ToastController
  ) {
    this.initialize();
  }
  
  /**
   * Initialize the order service
   */
  async initialize() {
    await this.loadOrders();
  }
  
  /**
   * Get orders as an observable
   */
  get orders(): Observable<Order[]> {
    return this._orders.asObservable();
  }
  
  /**
   * Get current value of orders
   */
  get ordersValue(): Order[] {
    return this._orders.getValue();
  }
  
  /**
   * Load orders from storage and API
   */
  async loadOrders() {
    try {
      // First load from storage for immediate display
      const storedOrders = await this.storage.get(this.ORDERS_STORAGE_KEY);
      if (storedOrders) {
        this._orders.next(storedOrders);
      }
      
      // Then try to fetch from API if user is logged in
      if (this.authService.isLoggedIn) {
        this.fetchOrders().subscribe();
      }
    } catch (error) {
      console.error('Error loading orders from storage:', error);
    }
  }
  
  /**
   * Fetch orders from the API
   */
  fetchOrders(): Observable<Order[]> {
    if (!this.authService.isLoggedIn) {
      return of(this.ordersValue);
    }
    
    const userId = this.authService.userValue?.id;
    
    return this.http.get<Order[]>(`${this.apiUrl}/orders`, {
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret,
        customer: userId ? userId.toString() : '',
        per_page: '50'
      }
    }).pipe(
      tap(orders => {
        this._orders.next(orders);
        this.saveOrders(orders);
      }),
      catchError(error => {
        console.error('Error fetching orders:', error);
        return of(this.ordersValue);
      })
    );
  }
  
  /**
   * Get orders for a specific customer
   * @param customerId The ID of the customer
   */
  getCustomerOrders(customerId: number): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders`, {
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret,
        customer: customerId.toString(),
        per_page: '50'
      }
    }).pipe(
      catchError(error => {
        console.error(`Error fetching orders for customer ${customerId}:`, error);
        return of([]);
      })
    );
  }
  
  /**
   * Update the status of an order
   * @param orderId The ID of the order
   * @param status The new status
   */
  updateOrderStatus(orderId: number, status: string): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/orders/${orderId}`, {
      status
    }, {
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }
    }).pipe(
      tap(updatedOrder => {
        // Update the order in the local list
        const currentOrders = this.ordersValue;
        const updatedOrders = currentOrders.map(order => 
          order.id === updatedOrder.id ? updatedOrder : order
        );
        this._orders.next(updatedOrders);
        this.saveOrders(updatedOrders);
      }),
      catchError(error => {
        console.error(`Error updating order ${orderId}:`, error);
        return throwError(() => new Error('Failed to update order status'));
      })
    );
  }
  
  /**
   * Get a specific order by ID
   * @param orderId The ID of the order to fetch
   */
  getOrder(orderId: number): Observable<Order> {
    // First check if we have it in memory
    const cachedOrder = this.ordersValue.find(order => order.id === orderId);
    if (cachedOrder) {
      return of(cachedOrder);
    }
    
    // Otherwise fetch from API
    return this.http.get<Order>(`${this.apiUrl}/orders/${orderId}`, {
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }
    }).pipe(
      catchError(error => {
        console.error(`Error fetching order ${orderId}:`, error);
        return throwError(() => new Error('Failed to fetch order details'));
      })
    );
  }
  
  /**
   * Create a new order
   * @param cart The cart to create an order from
   * @param billingDetails The billing details
   * @param shippingDetails The shipping details
   * @param paymentMethod The payment method
   * @param paymentResult The payment result
   */
  createOrder(
    cart: Cart,
    billingDetails: any,
    shippingDetails: any,
    paymentMethod: string,
    paymentResult: any
  ): Observable<Order> {
    // Prepare line items
    const lineItems = cart.items.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      name: item.product.name,
      price: parseFloat(item.product.price)
    }));
    
    // Prepare order data
    const orderData = {
      payment_method: paymentMethod,
      payment_method_title: this.getPaymentMethodTitle(paymentMethod),
      set_paid: paymentMethod !== 'cod', // Mark as paid if not Cash on Delivery
      billing: billingDetails,
      shipping: shippingDetails,
      line_items: lineItems,
      customer_id: this.authService.isLoggedIn ? this.authService.userValue?.id : 0,
      customer_note: '',
      shipping_lines: [
        {
          method_id: 'flat_rate',
          method_title: 'Flat Rate',
          total: cart.shipping.toString()
        }
      ],
      fee_lines: [
        {
          name: 'VAT (15%)',
          total: cart.vat.toString(),
          tax_class: 'standard',
          tax_status: 'taxable'
        }
      ],
      meta_data: [
        {
          key: 'transaction_id',
          value: paymentResult?.transactionId || ''
        },
        {
          key: 'payment_details',
          value: JSON.stringify(paymentResult || {})
        }
      ]
    };
    
    return this.http.post<Order>(`${this.apiUrl}/orders`, orderData, {
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }
    }).pipe(
      tap(order => {
        // Add to local orders list
        const currentOrders = this.ordersValue;
        const updatedOrders = [order, ...currentOrders];
        this._orders.next(updatedOrders);
        this.saveOrders(updatedOrders);
        
        this.presentToast('Order placed successfully!');
      }),
      catchError(error => {
        console.error('Error creating order:', error);
        this.presentToast('Failed to create order. Please try again.');
        return throwError(() => new Error('Failed to create order'));
      })
    );
  }
  
  /**
   * Save orders to storage
   * @param orders The orders to save
   */
  private async saveOrders(orders: Order[]) {
    try {
      await this.storage.set(this.ORDERS_STORAGE_KEY, orders);
    } catch (error) {
      console.error('Error saving orders to storage:', error);
    }
  }
  
  /**
   * Get payment method title
   * @param method The payment method
   */
  private getPaymentMethodTitle(method: string): string {
    switch (method) {
      case 'creditcard':
        return 'Credit Card';
      case 'applepay':
        return 'Apple Pay';
      case 'stcpay':
        return 'STC Pay';
      case 'cod':
        return 'Cash on Delivery';
      default:
        return 'Unknown Payment Method';
    }
  }
  
  /**
   * Present a toast message
   * @param message The message to display
   */
  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    
    await toast.present();
  }
}