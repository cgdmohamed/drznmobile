import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ComponentsModule } from './components/components.module';

// Register Swiper Elements
import { register } from 'swiper/element/bundle';
register(); // Call the register function to register Swiper custom elements

// Interceptors
import { TokenInterceptor } from './interceptors/token.interceptor';

// Services
import { JwtAuthService } from './services/jwt-auth.service';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule, 
    IonicModule.forRoot({
      mode: 'md',
      backButtonText: ''
    }), 
    AppRoutingModule,
    HttpClientModule,
    IonicStorageModule.forRoot(),
    ComponentsModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
    JwtAuthService
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}