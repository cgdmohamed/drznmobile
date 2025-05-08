import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-currency-icon',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <span class="currency-icon-wrapper" [ngClass]="{'inline': inline}">
      <img src="assets/icons/sar-symbol.svg" alt="SAR" class="currency-icon" [ngClass]="size">
    </span>
  `,
  styles: [`
    .currency-icon-wrapper {
      display: inline-flex;
      align-items: center;
      margin: 0 4px;
    }
    
    .currency-icon-wrapper.inline {
      vertical-align: middle;
    }
    
    .currency-icon {
      width: 16px;
      height: 16px;
    }
    
    .small {
      width: 12px;
      height: 12px;
    }
    
    .medium {
      width: 16px;
      height: 16px;
    }
    
    .large {
      width: 20px;
      height: 20px;
    }
  `]
})
export class CurrencyIconComponent {
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() inline: boolean = true;
}