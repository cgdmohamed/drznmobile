import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NotificationSenderService } from '../../../services/notification-sender.service';
import { JwtAuthService } from '../../../services/jwt-auth.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/account"></ion-back-button>
        </ion-buttons>
        <ion-title>إدارة الإشعارات</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div *ngIf="!isAdmin" class="no-access">
        <ion-icon name="lock-closed-outline" size="large"></ion-icon>
        <h2>غير مصرح</h2>
        <p>عذرا، لا يمكنك الوصول إلى هذه الصفحة</p>
      </div>

      <div *ngIf="isAdmin">
        <ion-card>
          <ion-card-header>
            <ion-card-title>إرسال إشعار</ion-card-title>
            <ion-card-subtitle>أرسل إشعارات لجميع مستخدمي التطبيق</ion-card-subtitle>
          </ion-card-header>

          <ion-card-content>
            <ion-list lines="full">
              <ion-item>
                <ion-label position="stacked">عنوان الإشعار</ion-label>
                <ion-input [(ngModel)]="notificationTitle" placeholder="أدخل عنوان الإشعار"></ion-input>
              </ion-item>

              <ion-item>
                <ion-label position="stacked">نص الإشعار</ion-label>
                <ion-textarea [(ngModel)]="notificationMessage" rows="4" placeholder="أدخل محتوى الإشعار"></ion-textarea>
              </ion-item>

              <ion-item>
                <ion-label>نوع الإشعار</ion-label>
                <ion-select [(ngModel)]="notificationType" interface="action-sheet">
                  <ion-select-option value="all">جميع المستخدمين</ion-select-option>
                  <ion-select-option value="order">إشعار طلب</ion-select-option>
                  <ion-select-option value="promotion">إشعار عرض</ion-select-option>
                </ion-select>
              </ion-item>

              <ng-container *ngIf="notificationType === 'order'">
                <ion-item>
                  <ion-label position="stacked">رقم الطلب</ion-label>
                  <ion-input [(ngModel)]="orderId" type="number" placeholder="أدخل رقم الطلب"></ion-input>
                </ion-item>
              </ng-container>

              <ng-container *ngIf="notificationType === 'promotion'">
                <ion-item>
                  <ion-label position="stacked">رابط العرض (اختياري)</ion-label>
                  <ion-input [(ngModel)]="promotionUrl" placeholder="أدخل رابط العرض"></ion-input>
                </ion-item>
              </ng-container>
            </ion-list>

            <div class="ion-padding">
              <ion-button expand="block" (click)="sendNotification()" [disabled]="!canSendNotification() || isLoading">
                <ion-spinner *ngIf="isLoading" name="crescent"></ion-spinner>
                <span *ngIf="!isLoading">إرسال الإشعار</span>
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card *ngIf="notificationResult">
          <ion-card-header [color]="notificationSuccess ? 'success' : 'danger'">
            <ion-card-title>{{ notificationSuccess ? 'تم الإرسال بنجاح' : 'فشل الإرسال' }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p *ngIf="notificationSuccess">
              تم إرسال الإشعار بنجاح إلى {{ recipientCount }} مستخدم.
            </p>
            <p *ngIf="!notificationSuccess">
              {{ errorMessage }}
            </p>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styles: [`
    .no-access {
      text-align: center;
      padding: 40px 20px;
    }
    
    .no-access ion-icon {
      font-size: 64px;
      margin-bottom: 16px;
      color: var(--ion-color-medium);
    }
    
    .no-access h2 {
      font-size: 20px;
      margin-bottom: 8px;
    }
    
    .no-access p {
      color: var(--ion-color-medium);
    }
  `]
})
export class AdminNotificationsPage implements OnInit {
  isAdmin = false;
  isLoading = false;
  
  // Notification form
  notificationTitle = '';
  notificationMessage = '';
  notificationType: 'all' | 'order' | 'promotion' = 'all';
  orderId: number | null = null;
  promotionUrl = '';
  
  // Result
  notificationResult = false;
  notificationSuccess = false;
  recipientCount = 0;
  errorMessage = '';

  constructor(
    private notificationSender: NotificationSenderService,
    private jwtAuthService: JwtAuthService
  ) { }

  ngOnInit() {
    this.checkAdminStatus();
  }
  
  /**
   * Check if current user has admin privileges
   */
  async checkAdminStatus() {
    try {
      const user = await this.jwtAuthService.getUser();
      // Check if user is an admin or has appropriate role
      // This depends on your user role structure
      this.isAdmin = user && user.role === 'administrator';
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.isAdmin = false;
    }
  }
  
  /**
   * Check if all required fields are filled
   */
  canSendNotification(): boolean {
    if (!this.notificationTitle || !this.notificationMessage) {
      return false;
    }
    
    if (this.notificationType === 'order' && !this.orderId) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Send notification based on form data
   */
  sendNotification() {
    if (!this.canSendNotification() || this.isLoading) {
      return;
    }
    
    this.isLoading = true;
    this.notificationResult = false;
    
    // Prepare notification data
    const notification: any = {
      title: this.notificationTitle,
      message: this.notificationMessage,
      type: this.notificationType
    };
    
    // Add type-specific data
    if (this.notificationType === 'order' && this.orderId) {
      notification.order_id = this.orderId;
    } else if (this.notificationType === 'promotion' && this.promotionUrl) {
      notification.url = this.promotionUrl;
    }
    
    // Send notification
    this.notificationSender.sendNotification(notification).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.notificationResult = true;
        this.notificationSuccess = response.success;
        this.recipientCount = response.recipients || 0;
        
        if (response.success) {
          // Reset form on success
          this.resetForm();
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationResult = true;
        this.notificationSuccess = false;
        this.errorMessage = error.error?.message || 'Failed to send notification. Please try again.';
        console.error('Error sending notification:', error);
      }
    });
  }
  
  /**
   * Reset form fields
   */
  resetForm() {
    this.notificationTitle = '';
    this.notificationMessage = '';
    this.notificationType = 'all';
    this.orderId = null;
    this.promotionUrl = '';
  }
}