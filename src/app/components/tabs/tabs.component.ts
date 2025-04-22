import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
  standalone: false
})
export class TabsComponent implements OnInit, OnDestroy {
  activeTab: string = 'home';
  private routerSubscription: Subscription;
  private authPages = ['/login', '/register', '/forgot-password', '/otp', '/verify-otp', '/reset-password'];
  showTabs: boolean = true;

  constructor(private router: Router) {
    // Subscribe to router events to update active tab
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        // Hide tabs on auth pages
        this.showTabs = !this.authPages.some(page => event.url.includes(page));
        
        // Set active tab based on current route
        if (event.url.includes('/home')) {
          this.activeTab = 'home';
        } else if (event.url.includes('/categories')) {
          this.activeTab = 'categories';
        } else if (event.url.includes('/wishlist')) {
          this.activeTab = 'wishlist';
        } else if (event.url.includes('/account')) {
          this.activeTab = 'account';
        } else if (event.url.includes('/profile')) {
          this.activeTab = 'profile';
        }
      });
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}