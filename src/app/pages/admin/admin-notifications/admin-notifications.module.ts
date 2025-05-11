import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { AdminNotificationsPage } from './admin-notifications.page';

const routes: Routes = [
  {
    path: '',
    component: AdminNotificationsPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    AdminNotificationsPage
  ]
})
export class AdminNotificationsPageModule {}