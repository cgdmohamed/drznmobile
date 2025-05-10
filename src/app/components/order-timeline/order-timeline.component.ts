import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Order } from '../../interfaces/order.interface';
import { OrderService, OrderStatus } from '../../services/order.service';

@Component({
  selector: 'app-order-timeline',
  templateUrl: './order-timeline.component.html',
  styleUrls: ['./order-timeline.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OrderTimelineComponent implements OnInit {
  @Input() order: Order;
  timelineEvents: { 
    status: string, 
    statusText: string, 
    date: Date, 
    icon: string, 
    color: string,
    description: string
  }[] = [];

  constructor(private orderService: OrderService) { }

  ngOnInit() {
    this.generateTimelineEvents();
  }

  /**
   * Generate timeline events from order data
   */
  private generateTimelineEvents() {
    if (!this.order) return;

    const events = [];

    // Add order created event
    events.push({
      status: 'created',
      statusText: 'تم إنشاء الطلب',
      date: new Date(this.order.date_created),
      icon: 'create-outline',
      color: 'medium',
      description: 'تم إنشاء طلبك وهو قيد المراجعة'
    });

    // Add payment event if paid
    if (this.order.date_paid) {
      events.push({
        status: 'paid',
        statusText: 'تم الدفع',
        date: new Date(this.order.date_paid),
        icon: 'cash-outline',
        color: 'success',
        description: `تم استلام مبلغ ${this.order.total} ريال سعودي`
      });
    }

    // Add current status event
    const currentStatus = this.order.status as OrderStatus;
    const statusInfo = this.orderService.getOrderStatusInfo(currentStatus);
    
    // Use the most accurate date for the current status
    let statusDate: Date;
    if (currentStatus === 'completed' && this.order.date_completed) {
      statusDate = new Date(this.order.date_completed);
    } else if (this.order.date_modified) {
      statusDate = new Date(this.order.date_modified);
    } else {
      // Fallback - use a time after creation
      statusDate = new Date(new Date(this.order.date_created).getTime() + 3600000); // 1 hour after creation
    }
    
    events.push({
      status: currentStatus,
      statusText: statusInfo.label,
      date: statusDate,
      icon: statusInfo.icon,
      color: statusInfo.color,
      description: statusInfo.description
    });
    
    // If order is processing and not yet completed, add a pending completion status
    if (currentStatus === 'processing' && !this.order.date_completed) {
      const completionInfo = this.orderService.getOrderStatusInfo('completed');
      const estimatedCompletionDate = new Date(statusDate.getTime() + 24 * 3600000); // 1 day after processing
      
      events.push({
        status: 'completion_pending',
        statusText: completionInfo.label + ' (متوقع)',
        date: estimatedCompletionDate,
        icon: completionInfo.icon,
        color: 'medium', // Use medium color for pending events
        description: 'الإكمال المتوقع للطلب'
      });
    }

    // Sort events by date
    this.timelineEvents = events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    // Format as "dd/MM/yyyy HH:mm"
    return date ? `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}` : '';
  }
}