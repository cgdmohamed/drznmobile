import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Address, AddressResponse } from '../interfaces/address.interface';
import { environment } from '../../environments/environment';
import { JwtAuthService } from './jwt-auth.service';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private apiUrl = environment.apiUrl;
  private addressEndpoint = '/custom-address-book/v1';
  
  // BehaviorSubject to store the addresses
  private _addresses: AddressResponse | null = null;
  
  constructor(
    private http: HttpClient,
    private jwtAuthService: JwtAuthService
  ) {
    // Load addresses on service initialization
    this.loadAddresses();
  }

  /**
   * Initial loading of addresses
   */
  private loadAddresses(): void {
    if (!this.jwtAuthService.isAuthenticated) {
      return;
    }
    
    this.fetchAddresses().subscribe(
      addresses => {
        this._addresses = addresses;
      },
      error => {
        console.error('Failed to load addresses on initialization:', error);
      }
    );
  }
  
  /**
   * Get all addresses for the current user
   */
  getAddresses(): Observable<AddressResponse> {
    if (this._addresses) {
      return of(this._addresses);
    }
    
    return this.fetchAddresses().pipe(
      map(addresses => {
        this._addresses = addresses;
        return addresses;
      })
    );
  }
  
  /**
   * Fetch addresses from the API
   */
  private fetchAddresses(): Observable<AddressResponse> {
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        return this.http.get<AddressResponse>(
          `${this.apiUrl}${this.addressEndpoint}/customers/${user.id}/addresses`
        ).pipe(
          catchError(error => {
            console.error('Error fetching addresses:', error);
            return throwError(() => new Error('Failed to retrieve addresses'));
          })
        );
      })
    );
  }

  /**
   * Get a specific address (billing or shipping)
   */
  getAddress(type: 'billing' | 'shipping'): Observable<Address> {
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        return this.http.get<Address>(
          `${this.apiUrl}${this.addressEndpoint}/customers/${user.id}/addresses/${type}`
        ).pipe(
          catchError(error => {
            console.error(`Error fetching ${type} address:`, error);
            return throwError(() => new Error(`Failed to retrieve ${type} address`));
          })
        );
      })
    );
  }

  /**
   * Update an existing address
   */
  updateAddress(type: 'billing' | 'shipping', address: Address): Observable<any> {
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        return this.http.put<any>(
          `${this.apiUrl}${this.addressEndpoint}/customers/${user.id}/addresses/${type}`,
          address
        ).pipe(
          map(response => {
            // Update local cache after successful update
            if (this._addresses) {
              this._addresses[type] = address;
            }
            return response;
          }),
          catchError(error => {
            console.error(`Error updating ${type} address:`, error);
            return throwError(() => new Error(`Failed to update ${type} address`));
          })
        );
      })
    );
  }

  /**
   * Add a new address
   */
  addAddress(address: Address): Observable<any> {
    if (!address.type || !['billing', 'shipping'].includes(address.type)) {
      return throwError(() => new Error('Invalid address type. Must be "billing" or "shipping"'));
    }
    
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        return this.http.post<any>(
          `${this.apiUrl}${this.addressEndpoint}/customers/${user.id}/addresses/${address.type}`,
          address
        ).pipe(
          map(response => {
            // Update local cache after successful creation
            if (this._addresses && address.type) {
              this._addresses[address.type] = address;
            }
            return response;
          }),
          catchError(error => {
            console.error(`Error adding ${address.type} address:`, error);
            return throwError(() => new Error(`Failed to add ${address.type} address`));
          })
        );
      })
    );
  }

  /**
   * Delete a billing or shipping address
   */
  deleteAddress(type: 'billing' | 'shipping'): Observable<any> {
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        return this.http.delete<any>(
          `${this.apiUrl}${this.addressEndpoint}/customers/${user.id}/addresses/${type}`
        ).pipe(
          map(response => {
            // Update local cache after successful deletion
            if (this._addresses) {
              this._addresses[type] = {} as Address;
            }
            return response;
          }),
          catchError(error => {
            console.error(`Error deleting ${type} address:`, error);
            return throwError(() => new Error(`Failed to delete ${type} address`));
          })
        );
      })
    );
  }
  
  /**
   * Set an address as default
   */
  setDefaultAddress(type: 'billing' | 'shipping'): Observable<any> {
    return this.getAddress(type).pipe(
      switchMap(address => {
        // Set is_default to true
        const updatedAddress = {
          ...address,
          is_default: true
        };
        
        return this.updateAddress(type, updatedAddress);
      })
    );
  }
}