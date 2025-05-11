import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotificationSenderService } from '../../services/notification-sender.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-demo',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterLink],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/home"></ion-back-button>
        </ion-buttons>
        <ion-title>اختبار الإشعارات</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>تطبيق الإشعارات</ion-card-title>
          <ion-card-subtitle>اختبار ميزات الإشعارات في تطبيق درزن</ion-card-subtitle>
        </ion-card-header>

        <ion-card-content>
          <ion-note>حالة OneSignal: {{ isOneSignalAvailable ? 'متاح' : 'غير متاح (محاكاة)' }}</ion-note>
          <p>هذه الصفحة مخصصة لاختبار وعرض ميزات الإشعارات في التطبيق.</p>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>إشعار محلي</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-item>
            <ion-label position="floating">عنوان الإشعار</ion-label>
            <ion-input [(ngModel)]="localTitle" placeholder="عنوان الإشعار"></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="floating">نص الإشعار</ion-label>
            <ion-textarea [(ngModel)]="localMessage" rows="3" placeholder="اكتب رسالة الإشعار"></ion-textarea>
          </ion-item>

          <div class="ion-padding">
            <ion-button expand="block" (click)="sendLocalNotification()">
              إرسال إشعار محلي
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <ion-card-title>إشعار للمستخدمين</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-item>
            <ion-label position="floating">عنوان الإشعار</ion-label>
            <ion-input [(ngModel)]="pushTitle" placeholder="عنوان الإشعار"></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="floating">نص الإشعار</ion-label>
            <ion-textarea [(ngModel)]="pushMessage" rows="3" placeholder="اكتب رسالة الإشعار"></ion-textarea>
          </ion-item>

          <ion-item>
            <ion-label>نوع الإشعار</ion-label>
            <ion-select [(ngModel)]="pushType" interface="action-sheet">
              <ion-select-option value="all">جميع المستخدمين</ion-select-option>
              <ion-select-option value="promotion">عروض وتخفيضات</ion-select-option>
            </ion-select>
          </ion-item>

          <div class="ion-padding">
            <ion-button expand="block" [disabled]="isSending" (click)="sendPushNotification()">
              <ion-spinner *ngIf="isSending" name="crescent"></ion-spinner>
              <span *ngIf="!isSending">إرسال إشعار للمستخدمين</span>
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
    </ion-content>
  `,
  styles: [`
    ion-card {
      margin-bottom: 20px;
    }
    
    ion-note {
      display: block;
      margin-bottom: 10px;
    }
  `]
})
export class NotificationDemoPage implements OnInit {
  isOneSignalAvailable = false;
  
  // Local notification
  localTitle = 'إشعار تجريبي';
  localMessage = 'هذا إشعار محلي للتجربة من تطبيق درزن';
  
  // Push notification
  pushTitle = 'إشعار تجريبي';
  pushMessage = 'هذا إشعار تجريبي من تطبيق درزن';
  pushType: 'all' | 'promotion' = 'all';
  
  // Sending state
  isSending = false;
  notificationResult = false;
  notificationSuccess = false;
  recipientCount = 0;
  errorMessage = '';

  constructor(
    private notificationService: NotificationService,
    private notificationSender: NotificationSenderService,
    private toastController: ToastController
  ) { }

  ngOnInit() {
    // Check if OneSignal is available
    this.isOneSignalAvailable = this.notificationService.isOneSignalAvailable();
  }
  
  /**
   * Send a local notification (appears only on this device)
   */
  async sendLocalNotification() {
    try {
      // Reset previous results
      this.notificationResult = false;
      
      if (!this.localTitle || !this.localMessage) {
        this.presentToast('يرجى إدخال عنوان ونص الإشعار');
        return;
      }
      
      await this.notificationService.showLocalNotification(
        this.localTitle,
        this.localMessage
      );
      
      this.presentToast('تم إرسال إشعار محلي بنجاح');
    } catch (error) {
      console.error('Error sending local notification:', error);
      this.presentToast('حدث خطأ أثناء إرسال الإشعار المحلي');
    }
  }
  
  /**
   * Send a push notification to users
   */
  sendPushNotification() {
    // Reset previous results
    this.notificationResult = false;
    
    if (!this.pushTitle || !this.pushMessage) {
      this.presentToast('يرجى إدخال عنوان ونص الإشعار');
      return;
    }
    
    this.isSending = true;
    
    // Prepare notification data
    const notification: any = {
      title: this.pushTitle,
      message: this.pushMessage,
      type: this.pushType
    };
    
    // Send notification
    this.notificationSender.sendNotification(notification).subscribe({
      next: (response) => {
        this.isSending = false;
        this.notificationResult = true;
        this.notificationSuccess = response.success;
        this.recipientCount = response.recipients || 0;
        
        if (response.success) {
          this.presentToast('تم إرسال الإشعار بنجاح');
        }
      },
      error: (error) => {
        this.isSending = false;
        this.notificationResult = true;
        this.notificationSuccess = false;
        this.errorMessage = error.error?.message || 'Failed to send notification. Please try again.';
        this.presentToast('حدث خطأ أثناء إرسال الإشعار');
        console.error('Error sending push notification:', error);
      }
    });
  }
  
  /**
   * Display a toast message
   */
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}