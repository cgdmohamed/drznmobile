import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

// Type for checkout step
export type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

@Component({
  selector: 'app-checkout-steps',
  templateUrl: './checkout-steps.component.html',
  styleUrls: ['./checkout-steps.component.scss'],
})
export class CheckoutStepsComponent implements OnInit {
  @Input() currentStep: CheckoutStep = 'shipping';
  @Output() stepChanged = new EventEmitter<CheckoutStep>();

  steps: { id: CheckoutStep, label: string }[] = [
    { id: 'shipping', label: 'الشحن' },
    { id: 'payment', label: 'الدفع' },
    { id: 'confirmation', label: 'التأكيد' }
  ];

  constructor() { }

  ngOnInit() {}

  // Check if a step is completed
  isCompleted(step: CheckoutStep): boolean {
    if (step === 'shipping') {
      return this.currentStep === 'payment' || this.currentStep === 'confirmation';
    }
    if (step === 'payment') {
      return this.currentStep === 'confirmation';
    }
    return false;
  }

  // Check if a step is active
  isActive(step: CheckoutStep): boolean {
    return this.currentStep === step;
  }

  // Change the current step
  changeStep(step: CheckoutStep) {
    this.stepChanged.emit(step);
  }
}