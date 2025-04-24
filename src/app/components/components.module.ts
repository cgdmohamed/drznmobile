import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Import components
import { ProductCardComponent } from './product-card/product-card.component';
import { CategoryItemComponent } from './category-item/category-item.component';
import { FilterModalComponent } from './filter-modal/filter-modal.component';
import { PaymentFormComponent } from './payment-form/payment-form.component';
import { TabsComponent } from './tabs/tabs.component';
import { SkeletonComponent } from './skeleton/skeleton.component';
import { CustomIconComponent } from './custom-icon/custom-icon.component';
import { RecommendationCarouselComponent } from './recommendation-carousel/recommendation-carousel.component';
import { PageTransitionComponent } from './page-transition/page-transition.component';
import { CachedImageComponent } from './cached-image/cached-image.component';

@NgModule({
  declarations: [
    ProductCardComponent,
    CategoryItemComponent,
    FilterModalComponent,
    PaymentFormComponent,
    TabsComponent,
    SkeletonComponent,
    RecommendationCarouselComponent,
    PageTransitionComponent,
    CachedImageComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    CustomIconComponent
  ],
  exports: [
    ProductCardComponent,
    CategoryItemComponent,
    FilterModalComponent,
    PaymentFormComponent,
    TabsComponent,
    SkeletonComponent,
    CustomIconComponent,
    RecommendationCarouselComponent,
    PageTransitionComponent,
    CachedImageComponent
  ]
})
export class ComponentsModule { }