import { Injectable } from '@angular/core';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Address, AddressResponse, CustomAddress } from '../interfaces/address.interface';
import { AddressService } from '../services/address.service';
import { JwtAuthService } from '../services/jwt-auth.service';

/**
 * Helper service for address management in the app
 * This provides a unified interface for working with billing, shipping, and custom addresses
 */
@Injectable({
  providedIn: 'root'
})
export class AddressHelper {
  // Local cache for all addresses (billing, shipping, custom)
  private allAddresses: (Address | CustomAddress)[] = [];
  private initialized = false;
  
  constructor(
    private addressService: AddressService,
    private jwtAuthService: JwtAuthService
  ) {
    this.initialize();
  }
  
  /**
   * Initialize the helper by loading all addresses
   */
  initialize(): void {
    console.log('Initializing AddressHelper');
    if (!this.jwtAuthService.isAuthenticated) {
      console.log('User not authenticated, skipping address initialization');
      return;
    }
    
    this.loadAllAddresses().subscribe(
      addresses => {
        console.log('Addresses loaded in helper:', addresses);
        this.allAddresses = addresses;
        this.initialized = true;
      },
      error => {
        console.error('Error loading addresses in helper:', error);
      }
    );
  }
  
  /**
   * Get all addresses (billing, shipping, and custom)
   */
  getAllAddresses(): Observable<(Address | CustomAddress)[]> {
    if (this.initialized && this.allAddresses.length > 0) {
      return of(this.allAddresses);
    }
    
    return this.loadAllAddresses();
  }
  
  /**
   * Load all addresses from the API
   */
  private loadAllAddresses(): Observable<(Address | CustomAddress)[]> {
    return forkJoin({
      standard: this.addressService.getAddresses().pipe(
        catchError(error => {
          console.error('Error loading standard addresses:', error);
          return of({ billing: {} as Address, shipping: {} as Address });
        })
      ),
      custom: this.addressService.getCustomAddresses().pipe(
        catchError(error => {
          console.error('Error loading custom addresses:', error);
          return of([]);
        })
      )
    }).pipe(
      map(({ standard, custom }) => {
        const addresses: (Address | CustomAddress)[] = [];
        
        // Add billing address if it exists and has required fields
        if (standard.billing && 
            standard.billing.first_name && 
            standard.billing.address_1) {
          addresses.push({
            ...standard.billing,
            id: 'billing',
            type: 'billing',
            is_default: true
          });
        }
        
        // Add shipping address if it exists and has required fields
        if (standard.shipping && 
            standard.shipping.first_name && 
            standard.shipping.address_1) {
          addresses.push({
            ...standard.shipping,
            id: 'shipping',
            type: 'shipping',
            is_default: false
          });
        }
        
        // Add all custom addresses
        addresses.push(...custom);
        
        // Update local cache
        this.allAddresses = addresses;
        this.initialized = true;
        
        return addresses;
      }),
      catchError(error => {
        console.error('Error in loadAllAddresses:', error);
        return throwError(() => new Error('Failed to load addresses'));
      })
    );
  }
  
  /**
   * Get an address by ID
   */
  getAddressById(addressId: string | number): Observable<Address | CustomAddress | null> {
    if (addressId === 'billing') {
      return this.addressService.getAddress('billing');
    } else if (addressId === 'shipping') {
      return this.addressService.getAddress('shipping');
    } else {
      // For custom addresses, check the local cache or fetch all
      if (this.initialized) {
        const address = this.allAddresses.find(addr => {
          if ('id' in addr) {
            return addr.id === addressId;
          }
          return false;
        });
        
        return of(address || null);
      } else {
        return this.getAllAddresses().pipe(
          map(addresses => {
            const address = addresses.find(addr => {
              if ('id' in addr) {
                return addr.id === addressId;
              }
              return false;
            });
            
            return address || null;
          })
        );
      }
    }
  }
  
  /**
   * Save an address (create or update)
   */
  saveAddress(address: Address | CustomAddress): Observable<any> {
    if ('id' in address && address.id) {
      // This is an existing address
      if (address.id === 'billing') {
        // Update billing address
        return this.addressService.updateAddress('billing', address).pipe(
          tap(() => this.refreshAddresses())
        );
      } else if (address.id === 'shipping') {
        // Update shipping address
        return this.addressService.updateAddress('shipping', address).pipe(
          tap(() => this.refreshAddresses())
        );
      } else {
        // Update custom address
        return this.addressService.updateCustomAddress(address.id, address as CustomAddress).pipe(
          tap(() => this.refreshAddresses())
        );
      }
    } else {
      // This is a new address
      if (address.type === 'billing') {
        // Add as billing
        return this.addressService.addAddress({
          ...address,
          type: 'billing'
        }).pipe(
          tap(() => this.refreshAddresses())
        );
      } else if (address.type === 'shipping') {
        // Add as shipping
        return this.addressService.addAddress({
          ...address,
          type: 'shipping'
        }).pipe(
          tap(() => this.refreshAddresses())
        );
      } else {
        // Add as custom
        return this.addressService.addCustomAddress(address as CustomAddress).pipe(
          tap(() => this.refreshAddresses())
        );
      }
    }
  }
  
  /**
   * Delete an address
   */
  deleteAddress(addressId: string | number): Observable<any> {
    if (addressId === 'billing' || addressId === 'shipping') {
      // For billing/shipping, we clear rather than delete
      return this.addressService.deleteAddress(addressId as string).pipe(
        tap(() => this.refreshAddresses())
      );
    } else {
      return this.addressService.deleteCustomAddress(addressId).pipe(
        tap(() => this.refreshAddresses())
      );
    }
  }
  
  /**
   * Set an address as default for checkout
   */
  setDefaultAddress(addressId: string | number): Observable<any> {
    return this.addressService.setDefaultAddress(addressId as string).pipe(
      tap(() => this.refreshAddresses())
    );
  }
  
  /**
   * Refresh all addresses
   */
  refreshAddresses(): Observable<(Address | CustomAddress)[]> {
    this.initialized = false;
    return this.loadAllAddresses();
  }
}