import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, timer } from 'rxjs';
import { catchError, tap, map, takeUntil, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Storage } from '@ionic/storage-angular';
import { Order } from '../interfaces/order.interface';
import { Cart } from '../interfaces/cart.interface';
import { ToastController, AlertController } from '@ionic/angular';
import { AuthService } from './auth.service';
import { NotificationService, NotificationData } from './notification.service';
import { demoProducts } from '../demo/demo-products';

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
    private toastController: ToastController,
    private alertController: AlertController,
    private notificationService: NotificationService
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
   * Track order status with periodic updates
   * @param orderId The ID of the order to track
   * @param intervalSeconds How often to check for updates (in seconds)
   * @param maxDurationMinutes Maximum tracking duration (in minutes)
   * @returns Observable that completes when tracking ends
   */
  trackOrderStatus(orderId: number, intervalSeconds: number = 30, maxDurationMinutes: number = 60): Observable<Order> {
    console.log(`Starting to track order ${orderId} status...`);
    
    // Keep track of the last known status to detect changes
    let lastKnownStatus: string | null = null;
    
    // Calculate how many attempts we'll make based on interval and max duration
    const maxAttempts = (maxDurationMinutes * 60) / intervalSeconds;
    let attemptCount = 0;
    
    // Create a timer that emits at the specified interval
    return timer(0, intervalSeconds * 1000).pipe(
      // Stop after maxDurationMinutes
      takeUntil(timer(maxDurationMinutes * 60 * 1000)),
      
      // For each timer tick, fetch the latest order
      switchMap(() => {
        attemptCount++;
        console.log(`Checking order ${orderId} status (attempt ${attemptCount}/${maxAttempts})...`);
        
        return this.getOrder(orderId).pipe(
          catchError(error => {
            console.error(`Error tracking order ${orderId}:`, error);
            return of(null as any);  // Continue tracking despite errors
          })
        );
      }),
      
      // Filter out null results and only emit when we have an order
      map(order => {
        if (!order) {
          throw new Error(`Failed to fetch order ${orderId}`);
        }
        return order;
      }),
      
      // Check if status changed and send notification if it did
      tap(order => {
        const currentStatus = order.status;
        
        // If this is the first check, just record the status
        if (lastKnownStatus === null) {
          lastKnownStatus = currentStatus;
          console.log(`Initial order status: ${currentStatus}`);
          return;
        }
        
        // If status changed, notify the user
        if (currentStatus !== lastKnownStatus) {
          console.log(`Order status changed from ${lastKnownStatus} to ${currentStatus}`);
          
          // Send notification about status change
          this.sendOrderStatusNotification(order);
          
          // Update the stored status
          lastKnownStatus = currentStatus;
          
          // Update orders in storage
          const currentOrders = this.ordersValue;
          const updatedOrders = currentOrders.map(o => 
            o.id === order.id ? order : o
          );
          this._orders.next(updatedOrders);
          this.saveOrders(updatedOrders);
        }
      }),
      
      // Stop tracking if order reaches a final status
      tap(order => {
        const finalStatuses = ['completed', 'cancelled', 'refunded', 'failed', 'trash'];
        if (finalStatuses.includes(order.status)) {
          console.log(`Order ${orderId} reached final status: ${order.status}. Stopping tracking.`);
          throw new Error('Order reached final status');  // Use error to complete the observable
        }
      }),
      
      catchError(error => {
        // If it's our "final status" error, complete cleanly
        if (error.message === 'Order reached final status') {
          return of(null as any);
        }
        
        // Otherwise, propagate the error
        console.error('Error in order tracking:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Send notification about order status change
   * @param order The updated order
   */
  private sendOrderStatusNotification(order: Order) {
    const statusMap: {[key: string]: string} = {
      'pending': 'قيد الانتظار',
      'processing': 'قيد المعالجة',
      'on-hold': 'معلق',
      'completed': 'مكتمل',
      'cancelled': 'ملغي',
      'refunded': 'مسترجع',
      'failed': 'فشل',
      'trash': 'محذوف'
    };
    
    const statusText = statusMap[order.status] || order.status;
    const orderNumber = order.number;
    const totalItems = order.line_items.length;
    
    // Create notification data
    const notification: NotificationData = {
      id: `order_${order.id}_${Date.now()}`,
      title: `تحديث حالة الطلب #${orderNumber}`,
      body: `تم تحديث حالة طلبك #${orderNumber} إلى "${statusText}"`,
      type: 'order',
      actionId: 'view_order',
      actionData: {
        orderId: order.id
      },
      isRead: false,
      receivedAt: new Date()
    };
    
    // Store the notification
    this.notificationService.storeNotification(notification);
    
    // Show toast
    this.presentToast(`تم تحديث حالة الطلب #${orderNumber} إلى "${statusText}"`);
  }
  
  /**
   * Cancel an order within specified time window (default: 1 minute)
   * @param orderId The ID of the order to cancel
   * @param timeWindowMinutes Maximum time allowed for cancellation
   */
  async cancelOrder(orderId: number, timeWindowMinutes: number = 1): Promise<boolean> {
    try {
      // Get the order
      const order = await this.getOrder(orderId).toPromise();
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Check if order is in a cancelable state
      const cancelableStatuses = ['pending', 'processing', 'on-hold'];
      if (!cancelableStatuses.includes(order.status)) {
        throw new Error(`Cannot cancel order in ${order.status} status`);
      }
      
      // Check if the order is within the cancellation window
      const orderDate = new Date(order.date_created);
      const now = new Date();
      const diffMinutes = (now.getTime() - orderDate.getTime()) / (1000 * 60);
      
      if (diffMinutes > timeWindowMinutes) {
        throw new Error(`Cancellation window of ${timeWindowMinutes} minute(s) has passed`);
      }
      
      // Update order status to cancelled
      const updatedOrder = await this.updateOrderStatus(orderId, 'cancelled').toPromise();
      
      // Show success message
      this.presentToast('تم إلغاء الطلب بنجاح');
      
      return true;
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      
      // Show error message based on specific error
      if (error.message.includes('window')) {
        // Cancellation window passed
        this.presentCancellationAlert('انتهت مهلة الإلغاء', 
          'لا يمكن إلغاء الطلب بعد مرور دقيقة من وقت الطلب. يرجى التواصل مع خدمة العملاء للمساعدة.');
      } else if (error.message.includes('status')) {
        // Invalid status for cancellation
        this.presentCancellationAlert('لا يمكن إلغاء الطلب', 
          'لا يمكن إلغاء الطلب في حالته الحالية. يرجى التواصل مع خدمة العملاء للمساعدة.');
      } else {
        // Generic error
        this.presentCancellationAlert('فشل إلغاء الطلب', 
          'حدث خطأ أثناء محاولة إلغاء الطلب. يرجى المحاولة مرة أخرى لاحقاً أو التواصل مع خدمة العملاء.');
      }
      
      return false;
    }
  }
  
  /**
   * Present an alert for cancellation errors
   */
  private async presentCancellationAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['حسناً']
    });
    
    await alert.present();
  }

  /**
   * Create a new order
   * @param orderData The order data or cart
   * @param billingDetails The billing details (optional if included in orderData)
   * @param shippingDetails The shipping details (optional if included in orderData)
   * @param paymentMethod The payment method (optional if included in orderData)
   * @param paymentResult The payment result (optional)
   */
  createOrder(
    orderDataOrCart: any,
    billingDetails?: any,
    shippingDetails?: any,
    paymentMethod?: string,
    paymentResult?: any
  ): Observable<Order> {
    let orderData: any;
    
    // Check if first parameter is a complete order object or a cart
    if (orderDataOrCart && orderDataOrCart.line_items) {
      // It's already a prepared order object
      orderData = orderDataOrCart;
      
      // If we're in demo mode, return a fake order
      if (!this.apiUrl || !this.consumerKey || !this.consumerSecret) {
        console.log('Using demo order creation mode');
        
        // Create a fake order response
        const demoOrder: Order = {
          id: Math.floor(Math.random() * 10000),
          number: `ORDER-${Date.now()}`,
          status: 'processing',
          date_created: new Date().toISOString(),
          total: orderData.line_items.reduce((total: number, item: any) => 
            total + (parseFloat(item.price || '0') * item.quantity), 0).toString(),
          line_items: orderData.line_items.map((item: any) => ({
            id: item.product_id,
            name: `Product #${item.product_id}`,
            product_id: item.product_id,
            variation_id: 0,
            quantity: item.quantity,
            tax_class: '',
            subtotal: '0',
            subtotal_tax: '0',
            total: '0',
            total_tax: '0',
            taxes: [],
            meta_data: [],
            sku: '',
            price: 0,
            image: {
              id: '',
              src: 'https://via.placeholder.com/50'
            }
          })),
          // Add other required Order fields
          parent_id: 0,
          order_key: `wc_order_${Date.now()}`,
          created_via: 'app',
          version: '1.0',
          currency: 'SAR',
          date_modified: new Date().toISOString(),
          discount_total: '0',
          discount_tax: '0',
          shipping_total: '0',
          shipping_tax: '0',
          cart_tax: '0',
          total_tax: '0',
          prices_include_tax: false,
          customer_id: 0,
          customer_ip_address: '',
          customer_user_agent: '',
          customer_note: orderData.customer_note || '',
          billing: orderData.billing || {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: 'SA',
            email: '',
            phone: ''
          },
          shipping: orderData.shipping || {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: 'SA'
          },
          payment_method: orderData.payment_method || 'cod',
          payment_method_title: orderData.payment_method_title || 'Cash on Delivery',
          transaction_id: '',
          date_paid: new Date().toISOString(),
          date_completed: '',
          cart_hash: '',
          tax_lines: [],
          shipping_lines: [{
            id: 1,
            method_title: 'Flat Rate',
            method_id: 'flat_rate',
            instance_id: '',
            total: '0',
            total_tax: '0',
            taxes: [],
            meta_data: []
          }],
          fee_lines: [],
          coupon_lines: [],
          refunds: [],
          meta_data: orderData.meta_data || [],
          _links: {
            self: [{
              href: ''
            }],
            collection: [{
              href: ''
            }]
          }
        };
        
        // Add to local orders list
        const currentOrders = this.ordersValue;
        const updatedOrders = [demoOrder, ...currentOrders];
        this._orders.next(updatedOrders);
        this.saveOrders(updatedOrders);
        
        this.presentToast('Order placed successfully!');
        return of(demoOrder);
      }
    } else if (orderDataOrCart && orderDataOrCart.items && billingDetails) {
      // It's a cart object, need to build order data
      const cart = orderDataOrCart as Cart;
      
      // Prepare line items
      const lineItems = cart.items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        name: item.product.name,
        price: parseFloat(item.product.price)
      }));
      
      // Prepare order data
      orderData = {
        payment_method: paymentMethod || 'cod',
        payment_method_title: this.getPaymentMethodTitle(paymentMethod || 'cod'),
        set_paid: paymentMethod !== 'cod', // Mark as paid if not Cash on Delivery
        billing: billingDetails,
        shipping: shippingDetails || billingDetails,
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
            total: cart.vat.toString()
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
    } else {
      // Invalid parameters
      console.error('Invalid parameters for createOrder');
      return throwError(() => new Error('Invalid parameters for creating order'));
    }
    
    // Determine if we're on a mobile device
    const isMobile = this.authService.isMobilePlatform();
    
    let url: string;
    let requestOptions: any = {
      // Always include consumer key/secret in params to ensure TokenInterceptor knows this is a WooCommerce API request
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }
    };
    
    if (isMobile) {
      // For mobile devices, use absolute URL with consumer keys in URL (avoid CORS issues)
      url = `https://${environment.storeUrl}/wp-json/wc/v3/orders?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
      // On mobile, we include consumer keys in both URL and params to ensure tokenInterceptor ignores this request 
    } else {
      // For web development, use relative URL with consumer keys in params
      url = `${this.apiUrl}/orders`;
      // Params already set above
    }
    
    console.log('Creating order with URL:', url);
    
    return this.http.post<Order>(url, orderData, requestOptions).pipe(
      map((response: any) => {
        console.log('Order creation response:', response);
        
        // Handle both normal and error-like success responses
        let order: Order;
        
        // Check if response is already an Order object
        if (response && typeof response === 'object' && 'id' in response) {
          // Use unknown as intermediate type for safe casting
          order = response as unknown as Order;
        }
        // Check if it might be an error object with data
        else if (response && typeof response === 'object') {
          // Create a type guard to check if response has an error property
          const responseObj = response as Record<string, any>;
          const hasError = 'error' in responseObj && responseObj.error !== null && responseObj.error !== undefined;
          
          if (hasError) {
            const responseError = responseObj.error as any;
            // If there's a data property with the actual order
            if (responseError && typeof responseError === 'object' && 'data' in responseError) {
              const responseData = responseError.data;
              if (responseData && typeof responseData === 'object') {
                order = responseData as Order;
              } else {
                throw new Error('Invalid order response data format');
              }
            } else {
              throw new Error('Invalid order response error format');
            }
          } else {
            throw new Error('Response object missing expected properties');
          }
        } else {
          throw new Error('Invalid order response format');
        }
        
        // Add to local orders list
        const currentOrders = this.ordersValue;
        const updatedOrders = [order, ...currentOrders];
        this._orders.next(updatedOrders);
        this.saveOrders(updatedOrders);
        
        this.presentToast('Order placed successfully!');
        return order;
      }),
      catchError(error => {
        // Check if the error actually contains a successful response
        if (error && typeof error === 'object') {
          const errorObj = error as Record<string, any>;
          
          if ('error' in errorObj && errorObj.error && typeof errorObj.error === 'object') {
            // Check if this is actually a successful order (has ID)
            const errorData = errorObj.error as Record<string, any>;
            
            if ('id' in errorData) {
              console.log('Detected successful order creation within error response', errorData);
              
              // Extract order from error
              const order = errorData as unknown as Order;
              
              // Add to local orders list
              const currentOrders = this.ordersValue;
              const updatedOrders = [order, ...currentOrders];
              this._orders.next(updatedOrders);
              this.saveOrders(updatedOrders);
              
              this.presentToast('Order placed successfully!');
              return of(order);
            }
          }
        }
        
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