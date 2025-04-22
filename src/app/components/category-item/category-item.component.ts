import { Component, OnInit, Input } from '@angular/core';
import { Category } from '../../interfaces/category.interface';

@Component({
  selector: 'app-category-item',
  templateUrl: './category-item.component.html',
  styleUrls: ['./category-item.component.scss'],
  standalone: false
})
export class CategoryItemComponent implements OnInit {
  @Input() category: Category;

  constructor() { }

  ngOnInit() {}

  getCategoryImage(): string {
    // Return category image if available, otherwise return placeholder
    if (this.category?.image?.src) {
      return this.category.image.src;
    }
    return 'assets/images/product-placeholder.svg';
  }
}