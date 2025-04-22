import { Component, OnInit, Input } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-test-card-info',
  templateUrl: './test-card-info.component.html',
  styleUrls: ['./test-card-info.component.scss'],
  standalone: false
})
export class TestCardInfoComponent implements OnInit {
  @Input() expanded: boolean = false;
  
  constructor(private toastController: ToastController) { }

  ngOnInit() {}

  toggleExpanded() {
    this.expanded = !this.expanded;
  }
  
  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        this.presentToast('تم نسخ النص');
      },
      (err) => {
        console.error('Error copying text: ', err);
        this.presentToast('حدث خطأ أثناء نسخ النص');
      }
    );
  }
  
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom'
    });
    
    await toast.present();
  }
}