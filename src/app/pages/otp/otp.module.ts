import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { OtpPageRoutingModule } from './otp-routing.module';
import { OtpPage } from './otp.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OtpPageRoutingModule,
    OtpPage // Import instead of declare for standalone components
  ],
  // Remove declarations for standalone components
  // declarations: [OtpPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class OtpPageModule {}
