import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ProductDetailPage } from './product-detail.page';
import { ComponentsModule } from '../../components/components.module';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CurrencyIconComponent } from '../../components/currency-icon/currency-icon.component';

const routes: Routes = [
  {
    path: '',
    component: ProductDetailPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    ComponentsModule,
    RouterModule.forChild(routes),
    CurrencyIconComponent
  ],
  declarations: [ProductDetailPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Add this to support custom elements
})
export class ProductDetailPageModule {}