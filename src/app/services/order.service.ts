import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Order } from '../interfaces/order.interface';
import { environment } from '../../environments/environment';
import { CartService } from './cart.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;

  constructor(
    private http: HttpClient,
    private cartService: CartService
  ) {}

  // Create a new order
  createOrder(orderData: any): Observable<Order> {
    // In a real application, this would connect to WooCommerce API
    // const url = `${this.apiUrl}/orders?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    // return this.http.post<Order>(url, orderData);
    
    // For demo purposes, use a simulated response
    return this.createDemoOrder(orderData);
  }

  // Get order details by ID
  getOrder(id: number): Observable<Order> {
    // In a real application, this would connect to WooCommerce API
    // const url = `${this.apiUrl}/orders/${id}?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    // return this.http.get<Order>(url);

    // First check if this order exists in our completed orders
    const existingOrder = this.completedOrders.find(order => order.id === id);
    if (existingOrder) {
      return of(existingOrder);
    }
    
    // If not found, generate a demo order
    return of(this.generateDemoOrder());
  }

  // Get all orders for a customer
  getCustomerOrders(customerId: number): Observable<Order[]> {
    // In a real application, this would connect to WooCommerce API
    // const url = `${this.apiUrl}/orders?customer=${customerId}&consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    // return this.http.get<Order[]>(url);

    // For demo purposes, return completed orders created in this session
    // If there are no completed orders yet, generate a few sample ones
    if (this.completedOrders.length === 0) {
      // Add a few sample orders for display
      for (let i = 0; i < 3; i++) {
        const order = this.generateDemoOrder();
        // Make the demo orders have different statuses
        if (i === 0) {
          order.status = 'completed';
          order.date_completed = new Date().toISOString();
        } else if (i === 1) {
          order.status = 'processing';
        }
        this.completedOrders.push(order);
      }
    }
    
    // Return combined order list (including any newly created ones)
    return of(this.completedOrders);
  }

  // Update order status
  updateOrderStatus(orderId: number, status: string): Observable<Order> {
    // In a real application, this would connect to WooCommerce API
    // const url = `${this.apiUrl}/orders/${orderId}?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    // return this.http.put<Order>(url, { status });

    // For demo purposes, return a modified order
    const order = this.generateDemoOrder();
    order.status = status;
    return of(order);
  }

  // Prepare order data from cart
  prepareOrderFromCart(customerData: any): any {
    const cart = this.cartService.cartValue;
    
    // Prepare line items
    const line_items = cart.items.map(item => {
      return {
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.on_sale ? item.product.sale_price : item.product.regular_price
      };
    });

    // Prepare shipping lines
    const shipping_lines = [
      {
        method_id: 'flat_rate',
        method_title: 'Standard Shipping',
        total: cart.shipping.toString()
      }
    ];

    // Prepare order data
    return {
      payment_method: customerData.paymentMethod,
      payment_method_title: customerData.paymentMethodTitle,
      customer_id: customerData.customerId || 0,
      billing: {
        first_name: customerData.billingFirstName,
        last_name: customerData.billingLastName,
        address_1: customerData.billingAddress1,
        address_2: customerData.billingAddress2 || '',
        city: customerData.billingCity,
        state: customerData.billingState || '',
        postcode: customerData.billingPostcode,
        country: customerData.billingCountry || 'SA',
        email: customerData.billingEmail,
        phone: customerData.billingPhone
      },
      shipping: {
        first_name: customerData.shippingFirstName || customerData.billingFirstName,
        last_name: customerData.shippingLastName || customerData.billingLastName,
        address_1: customerData.shippingAddress1 || customerData.billingAddress1,
        address_2: customerData.shippingAddress2 || customerData.billingAddress2 || '',
        city: customerData.shippingCity || customerData.billingCity,
        state: customerData.shippingState || customerData.billingState || '',
        postcode: customerData.shippingPostcode || customerData.billingPostcode,
        country: customerData.shippingCountry || customerData.billingCountry || 'SA'
      },
      line_items,
      shipping_lines
    };
  }

  // Complete payment for an order
  completePayment(orderId: number, transactionId: string): Observable<Order> {
    // In a real application, this would update the order with payment details
    // const url = `${this.apiUrl}/orders/${orderId}?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    // return this.http.put<Order>(url, { 
    //   status: 'processing', 
    //   transaction_id: transactionId,
    //   date_paid: new Date().toISOString()
    // });

    // For demo purposes, return a modified order
    const order = this.generateDemoOrder();
    order.status = 'processing';
    order.transaction_id = transactionId;
    order.date_paid = new Date().toISOString();
    return of(order);
  }

  // Generate a demo order
  private generateDemoOrder(): Order {
    const orderId = Math.floor(Math.random() * 10000);
    const date = new Date().toISOString();
    const cart = this.cartService.cartValue;
    
    return {
      id: orderId,
      parent_id: 0,
      number: `WC${orderId}`,
      order_key: `wc_order_${Math.random().toString(36).substr(2, 9)}`,
      created_via: 'app',
      version: '1.0.0',
      status: 'pending',
      currency: 'SAR',
      date_created: date,
      date_modified: date,
      discount_total: cart.discount.toString(),
      discount_tax: '0',
      shipping_total: cart.shipping.toString(),
      shipping_tax: '0',
      cart_tax: cart.vat.toString(),
      total: cart.total.toString(),
      total_tax: cart.vat.toString(),
      prices_include_tax: true,
      customer_id: 1,
      customer_ip_address: '127.0.0.1',
      customer_user_agent: 'DARZN App',
      customer_note: '',
      billing: {
        first_name: 'مستخدم',
        last_name: 'تجريبي',
        company: '',
        address_1: 'شارع الرياض',
        address_2: '',
        city: 'الرياض',
        state: '',
        postcode: '12345',
        country: 'SA',
        email: 'test@example.com',
        phone: '05xxxxxxxx'
      },
      shipping: {
        first_name: 'مستخدم',
        last_name: 'تجريبي',
        company: '',
        address_1: 'شارع الرياض',
        address_2: '',
        city: 'الرياض',
        state: '',
        postcode: '12345',
        country: 'SA'
      },
      payment_method: 'creditcard',
      payment_method_title: 'Credit Card (Moyasar)',
      transaction_id: '',
      date_paid: null,
      date_completed: null,
      cart_hash: '',
      line_items: cart.items.map(item => {
        return {
          id: Math.floor(Math.random() * 10000),
          name: item.product.name,
          product_id: item.product.id,
          variation_id: 0,
          quantity: item.quantity,
          tax_class: '',
          subtotal: (parseFloat(item.product.price) * item.quantity).toString(),
          subtotal_tax: '0',
          total: (parseFloat(item.product.price) * item.quantity).toString(),
          total_tax: '0',
          taxes: [],
          meta_data: [],
          sku: item.product.sku,
          price: parseFloat(item.product.price),
          image: {
            id: item.product.images && item.product.images.length > 0 ? item.product.images[0].id.toString() : '',
            src: item.product.images && item.product.images.length > 0 ? item.product.images[0].src : ''
          }
        };
      }),
      tax_lines: [],
      shipping_lines: [
        {
          id: Math.floor(Math.random() * 10000),
          method_title: 'Standard Shipping',
          method_id: 'flat_rate',
          instance_id: '1',
          total: cart.shipping.toString(),
          total_tax: '0',
          taxes: [],
          meta_data: []
        }
      ],
      fee_lines: [],
      coupon_lines: [],
      refunds: [],
      meta_data: [],
      _links: {
        self: [
          {
            href: `${environment.apiUrl}/orders/${orderId}`
          }
        ],
        collection: [
          {
            href: `${environment.apiUrl}/orders`
          }
        ]
      }
    };
  }

  // Store completed orders to display in user profile
  private completedOrders: Order[] = [];
  
  // Create a demo order from order data
  private createDemoOrder(orderData: any): Observable<Order> {
    // Generate a basic order
    const order = this.generateDemoOrder();
    
    // Customize it with the provided data
    if (orderData.billing) {
      order.billing = {
        ...order.billing,
        first_name: orderData.billing.first_name,
        last_name: orderData.billing.last_name,
        address_1: orderData.billing.address_1,
        address_2: orderData.billing.address_2 || '',
        city: orderData.billing.city,
        state: orderData.billing.state || '',
        postcode: orderData.billing.postcode,
        country: orderData.billing.country || 'SA',
        email: orderData.billing.email,
        phone: orderData.billing.phone
      };
    }
    
    if (orderData.shipping) {
      order.shipping = {
        ...order.shipping,
        first_name: orderData.shipping.first_name,
        last_name: orderData.shipping.last_name,
        address_1: orderData.shipping.address_1,
        address_2: orderData.shipping.address_2 || '',
        city: orderData.shipping.city,
        state: orderData.shipping.state || '',
        postcode: orderData.shipping.postcode,
        country: orderData.shipping.country || 'SA'
      };
    }
    
    if (orderData.payment_method) {
      order.payment_method = orderData.payment_method;
      order.payment_method_title = orderData.payment_method_title || 'Credit Card (Moyasar)';
      
      // Set status based on payment method
      if (orderData.payment_method === 'cod') {
        order.status = 'processing';
      } else if (orderData.payment_method === 'moyasar') {
        order.status = 'processing';
        order.date_paid = new Date().toISOString();
      }
    }
    
    // Store the order in our local storage for demo purposes
    // This allows us to display it in the user's orders page
    this.completedOrders.push(order);
    
    return of(order);
  }
}