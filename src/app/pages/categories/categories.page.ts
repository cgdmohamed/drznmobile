import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Category } from '../../interfaces/category.interface';
import { IonInfiniteScroll } from '@ionic/angular';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: false
})
export class CategoriesPage implements OnInit {
  @ViewChild(IonInfiniteScroll) infiniteScroll: IonInfiniteScroll;
  
  categories: Category[] = [];
  isLoading = true;
  currentPage = 1;
  hasNextPage = true;
  perPage = 20;

  constructor(
    private productService: ProductService,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadCategories(true);
  }

  loadCategories(refresh: boolean = false) {
    if (refresh) {
      this.currentPage = 1;
      this.categories = [];
    }
    
    this.isLoading = true;
    
    this.productService.getCategories({
      page: this.currentPage,
      per_page: this.perPage
    }).subscribe({
      next: (response) => {
        // Append new categories to existing ones
        this.categories = [...this.categories, ...response];
        this.isLoading = false;
        
        // Check if we have more pages
        this.hasNextPage = response.length === this.perPage;
        
        // Reset the infinite scroll
        if (this.infiniteScroll) {
          this.infiniteScroll.complete();
        }
      },
      error: (error) => {
        console.error('Error fetching categories:', error);
        this.isLoading = false;
        
        // Reset the infinite scroll
        if (this.infiniteScroll) {
          this.infiniteScroll.complete();
        }
      }
    });
  }

  loadMoreCategories(event) {
    if (!this.hasNextPage) {
      event.target.complete();
      event.target.disabled = true;
      return;
    }
    
    this.currentPage++;
    this.loadCategories(false);
  }

  viewCategory(categoryId: number) {
    // Navigate to products page filtered by category
    this.router.navigate(['/category', categoryId]);
  }

  doRefresh(event: any) {
    this.loadCategories(true);
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}