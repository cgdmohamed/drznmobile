import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    // Check if user is logged in
    if (this.authService.isLoggedIn) {
      return true;
    }
    
    // If not logged in, show alert and redirect to login
    this.presentLoginAlert(state.url);
    return false;
  }
  
  // Present alert asking user to login
  async presentLoginAlert(redirectUrl: string) {
    const alert = await this.alertController.create({
      header: 'تسجيل الدخول مطلوب',
      message: 'يرجى تسجيل الدخول للوصول إلى هذه الصفحة',
      buttons: [
        {
          text: 'إلغاء',
          role: 'cancel',
          handler: () => {
            this.router.navigate(['/home']);
          }
        },
        {
          text: 'تسجيل الدخول',
          handler: () => {
            // Store the attempted URL for redirecting after login
            localStorage.setItem('redirectUrl', redirectUrl);
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    
    await alert.present();
  }
}