import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AnimationController } from '@ionic/angular';

@Component({
  selector: 'app-page-transition',
  templateUrl: './page-transition.component.html',
  styleUrls: ['./page-transition.component.scss'],
  standalone: false,
})
export class PageTransitionComponent implements OnInit, OnDestroy {
  loading = false;
  private routerSubscription: Subscription;

  constructor(
    private router: Router,
    private animationCtrl: AnimationController
  ) {}

  ngOnInit() {
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loading = true;
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        // Add a small delay before hiding to ensure the animation is visible
        // even on fast navigation
        setTimeout(() => {
          this.loading = false;
        }, 300);
      }
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}
