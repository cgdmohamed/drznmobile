import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { JwtAuthService } from './jwt-auth.service';

export interface NotificationRequest {
  title: string;
  message: string;
  type?: 'all' | 'order' | 'promotion';
  order_id?: number;
  url?: string;
}

export interface NotificationResponse {
  success: boolean;
  notification_id?: string;
  recipients?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationSenderService {
  private apiUrl = environment.storeUrl;

  constructor(
    private http: HttpClient,
    private jwtAuthService: JwtAuthService
  ) { }

  /**
   * Send a notification through the WordPress REST API
   * Requires user to have appropriate permissions on the WordPress site
   */
  sendNotification(notification: NotificationRequest): Observable<NotificationResponse> {
    // Get the JWT token
    const token = localStorage.getItem('jwt_token');
    
    if (!token) {
      throw new Error('Authentication token is required to send notifications');
    }
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.post<NotificationResponse>(
      `${this.apiUrl}/wp-json/onesignal-drzn/v1/send-notification`, 
      notification,
      { headers }
    ).pipe(
      map(response => {
        return {
          success: true,
          ...response
        };
      }),
      catchError(error => {
        console.error('Error sending notification:', error);
        return throwError(() => ({
          success: false,
          error: error.error?.message || 'Failed to send notification'
        }));
      })
    );
  }

  /**
   * Send order status notification to a specific user
   */
  sendOrderStatusNotification(
    orderId: number, 
    status: string, 
    title: string = 'Order Update', 
    customMessage?: string
  ): Observable<NotificationResponse> {
    // Generate default message based on status if not provided
    const message = customMessage || this.getOrderStatusMessage(status);
    
    return this.sendNotification({
      title,
      message,
      type: 'order',
      order_id: orderId
    });
  }

  /**
   * Send promotion notification to all users who enabled promotion notifications
   */
  sendPromotionNotification(
    title: string,
    message: string,
    url?: string
  ): Observable<NotificationResponse> {
    return this.sendNotification({
      title,
      message,
      type: 'promotion',
      url
    });
  }

  /**
   * Generate a standard message for an order status
   */
  private getOrderStatusMessage(status: string): string {
    switch (status.toLowerCase()) {
      case 'processing':
        return 'Your order is now being processed. We\'ll update you when it ships.';
      case 'completed':
        return 'Great news! Your order has been completed.';
      case 'shipped':
      case 'out-for-delivery':
        return 'Your order is on its way! Track your shipment for delivery updates.';
      case 'cancelled':
        return 'Your order has been cancelled. Please contact support if you have any questions.';
      case 'refunded':
        return 'Your order has been refunded. The amount should appear in your account within 3-5 business days.';
      case 'on-hold':
        return 'Your order is currently on hold. Our team will contact you shortly.';
      case 'failed':
        return 'There was an issue processing your order. Please contact customer support.';
      default:
        return `Your order status has been updated to: ${status}`;
    }
  }

  /**
   * Send a test notification (for debugging)
   */
  sendTestNotification(): Observable<NotificationResponse> {
    return this.sendNotification({
      title: 'Test Notification',
      message: 'This is a test notification from the DRZN app',
      type: 'all'
    });
  }
}