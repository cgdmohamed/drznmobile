import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CartPage } from './cart.page';
import { CurrencyIconComponent } from '../../components/currency-icon/currency-icon.component';

const routes: Routes = [
  {
    path: '',
    component: CartPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    CurrencyIconComponent
  ],
  declarations: [CartPage]
})
export class CartPageModule {}