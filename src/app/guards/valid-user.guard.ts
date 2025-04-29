import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { JwtAuthService } from '../services/jwt-auth.service';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ValidUserGuard implements CanActivate {
  
  constructor(
    private jwtAuthService: JwtAuthService,
    private router: Router,
    private alertController: AlertController
  ) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    return this.jwtAuthService.getUserAsObservable().pipe(
      take(1),
      map(user => {
        // Check if user is authenticated and has a valid ID
        if (!user || !user.id || user.id === 0) {
          console.log('ValidUserGuard: User not authenticated or has invalid ID');
          this.presentLoginAlert();
          return this.router.parseUrl('/login');
        }
        return true;
      }),
      catchError(() => {
        console.log('ValidUserGuard: Error getting user');
        this.presentLoginAlert();
        return of(this.router.parseUrl('/login'));
      })
    );
  }
  
  private async presentLoginAlert() {
    const alert = await this.alertController.create({
      header: 'تنبيه',
      message: 'يجب تسجيل الدخول أولاً للوصول إلى العناوين',
      buttons: ['موافق']
    });
    
    await alert.present();
  }
}
