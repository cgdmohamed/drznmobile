import { Component, OnInit, Input, ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconService } from '../../services/icon.service';

/**
 * Custom SVG icon component
 * 
 * Usage:
 * <app-custom-icon category="tab" name="home"></app-custom-icon>
 * 
 * The component handles loading the SVG from the right category and displays it inline.
 * Icons are cached automatically by the IconService.
 */
@Component({
  selector: 'app-custom-icon',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="custom-icon" [class]="size" [innerHTML]="svgIcon"></span>`,
  styles: [`
    .custom-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .custom-icon svg {
      width: 100%;
      height: 100%;
    }
    .small {
      width: 16px;
      height: 16px;
    }
    .medium {
      width: 24px;
      height: 24px;
    }
    .large {
      width: 32px;
      height: 32px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomIconComponent implements OnInit {
  @Input() category: 'tab' | 'nav' | 'action' = 'tab';
  @Input() name: string = '';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  
  svgIcon: any;
  
  constructor(
    private iconService: IconService,
    private el: ElementRef
  ) { }

  ngOnInit() {
    if (this.category && this.name) {
      this.iconService.getIcon(this.category, this.name).subscribe(svg => {
        this.svgIcon = svg;
      });
    }
  }
}