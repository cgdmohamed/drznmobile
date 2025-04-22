import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ProductService } from '../../services/product.service';
import { Category } from '../../interfaces/category.interface';

@Component({
  selector: 'app-filter-modal',
  templateUrl: './filter-modal.component.html',
  styleUrls: ['./filter-modal.component.scss'],
  standalone: false
})
export class FilterModalComponent implements OnInit {
  @Input() selectedBrands: string[] = [];
  @Input() selectedCategories: number[] = [];
  @Input() inStockOnly: boolean = false;
  @Input() priceRange: { lower: number; upper: number } = { lower: 0, upper: 1000 };
  
  categories: Category[] = [];
  brands: string[] = ['Harpic', 'Dettol', 'Clorox', 'Fairy', 'DAC', 'Persil', 'Dac'];
  maxPrice: number = 1000;
  
  constructor(
    private modalCtrl: ModalController,
    private productService: ProductService
  ) {}

  ngOnInit() {
    // Load categories
    this.productService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
    
    // Get max price for range
    this.productService.getMaxPrice().subscribe(price => {
      this.maxPrice = price;
      this.priceRange.upper = price;
    });
  }

  toggleBrand(brand: string) {
    const index = this.selectedBrands.indexOf(brand);
    if (index > -1) {
      this.selectedBrands.splice(index, 1);
    } else {
      this.selectedBrands.push(brand);
    }
  }

  toggleCategory(categoryId: number) {
    const index = this.selectedCategories.indexOf(categoryId);
    if (index > -1) {
      this.selectedCategories.splice(index, 1);
    } else {
      this.selectedCategories.push(categoryId);
    }
  }

  toggleInStock() {
    this.inStockOnly = !this.inStockOnly;
  }

  applyFilters() {
    this.modalCtrl.dismiss({
      brands: this.selectedBrands,
      categories: this.selectedCategories,
      inStockOnly: this.inStockOnly,
      priceRange: this.priceRange
    });
  }

  resetFilters() {
    this.selectedBrands = [];
    this.selectedCategories = [];
    this.inStockOnly = false;
    this.priceRange = { lower: 0, upper: this.maxPrice };
  }

  cancel() {
    this.modalCtrl.dismiss();
  }
}