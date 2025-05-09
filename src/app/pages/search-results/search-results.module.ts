import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ComponentsModule } from '../../components/components.module';
import { SearchResultsPage } from './search-results.page';

const routes: Routes = [
  {
    path: '',
    component: SearchResultsPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ComponentsModule,
    RouterModule.forChild(routes),
    SearchResultsPage // Import instead of declare for standalone components
],
  // declarations: [SearchResultsPage]
})
export class SearchResultsPageModule {}