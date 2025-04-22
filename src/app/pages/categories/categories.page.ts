import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { Category } from '../../interfaces/category.interface';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: false
})
export class CategoriesPage implements OnInit {
  categories: Category[] = [];
  isLoading = true;

  constructor(
    private productService: ProductService,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadCategories();
  }

  loadCategories() {
    this.isLoading = true;
    this.productService.getCategories().subscribe({
      next: (response) => {
        this.categories = response;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching categories:', error);
        this.isLoading = false;
      }
    });
  }

  viewCategory(categoryId: number) {
    // Navigate to products page filtered by category
    this.router.navigate(['/category', categoryId]);
  }

  doRefresh(event: any) {
    this.loadCategories();
    setTimeout(() => {
      event.target.complete();
    }, 1000);
  }
}