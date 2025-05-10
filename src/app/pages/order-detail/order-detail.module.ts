import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Routes, RouterModule } from '@angular/router';

import { OrderDetailPage } from './order-detail.page';
import { ComponentsModule } from '../../components/components.module';
import { CurrencyIconComponent } from '../../components/currency-icon/currency-icon.component';

const routes: Routes = [
  {
    path: '',
    component: OrderDetailPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    OrderDetailPage // Import instead of declare for standalone components,
    ComponentsModule,
    CurrencyIconComponent,
    OrderDetailPage // Import instead of declare for standalone components
],
  // // declarations: [OrderDetailPage]
})
export class OrderDetailPageModule {}