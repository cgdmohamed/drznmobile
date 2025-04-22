import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss'],
  standalone: false
})
export class SkeletonComponent {
  @Input() type: 'card' | 'list' | 'list-item' | 'category' | 'banner' | 'detail' | 'profile' | 'wishlist-item' = 'card';
  @Input() count: number = 1;
  @Input() animated: boolean = true;

  get countArray(): number[] {
    return Array(this.count).fill(0).map((x, i) => i);
  }
}