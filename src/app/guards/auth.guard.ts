import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { JwtAuthService } from '../services/jwt-auth.service';
import { map, take, catchError } from 'rxjs/operators';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private jwtAuthService: JwtAuthService,
    private router: Router,
    private alertController: AlertController
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    // First check if JWT auth is active (preferred method)
    if (this.jwtAuthService.isAuthenticated) {
      console.log('User authenticated via JWT');
      return true;
    }
    
    // If JWT auth not active, check legacy auth service as fallback
    if (this.authService.isLoggedIn) {
      console.log('User authenticated via legacy auth');
      return true;
    }
    
    // Check if we have a stored token but user state isn't loaded yet
    return this.checkStoredAuthentication().then(isAuth => {
      if (isAuth) {
        console.log('User authenticated via stored credentials');
        return true;
      }
      
      // If no valid authentication method, show login alert
      this.presentLoginAlert(state.url);
      return false;
    });
  }
  
  // Check if we have stored authentication that hasn't been loaded yet
  private async checkStoredAuthentication(): Promise<boolean> {
    try {
      // Try to get token from storage
      const token = await this.jwtAuthService.getToken();
      const user = await this.jwtAuthService.getUser();
      
      if (token && user) {
        console.log('Found valid stored credentials');
        // Force update user state with stored credentials
        this.jwtAuthService.setCurrentUser(user);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking stored authentication', error);
      return false;
    }
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