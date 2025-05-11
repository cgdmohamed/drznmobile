import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { NotificationDemoPage } from './notification-demo.page';

const routes: Routes = [
  {
    path: '',
    component: NotificationDemoPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    NotificationDemoPage
  ]
})
export class NotificationDemoPageModule {}