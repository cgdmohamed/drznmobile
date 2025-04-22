import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { PaymentCallbackPage } from './payment-callback.page';

const routes: Routes = [
  {
    path: '',
    component: PaymentCallbackPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  declarations: [PaymentCallbackPage]
})
export class PaymentCallbackPageModule {}