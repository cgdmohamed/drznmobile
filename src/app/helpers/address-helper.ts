import { Injectable } from '@angular/core';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Address, AddressResponse } from '../interfaces/address.interface';
import { AddressService, CustomAddress } from '../services/address.service';
import { JwtAuthService } from '../services/jwt-auth.service';
import { User } from '../interfaces/user.interface';

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
    // Always attempt to load addresses regardless of authentication state
    // The loadAllAddresses method will handle unauthenticated users
    
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
    return this.addressService.getAddresses().pipe(
      switchMap(addressResponse => {
        const standardAddresses: (Address | CustomAddress)[] = [];
        
        // Add billing address if it exists and has required fields
        if (addressResponse.billing && 
            addressResponse.billing.first_name && 
            addressResponse.billing.address_1) {
          standardAddresses.push({
            ...addressResponse.billing,
            id: 'billing',
            type: 'billing',
            is_default: true
          });
        }
        
        // Add shipping address if it exists and has required fields
        if (addressResponse.shipping && 
            addressResponse.shipping.first_name && 
            addressResponse.shipping.address_1) {
          standardAddresses.push({
            ...addressResponse.shipping,
            id: 'shipping',
            type: 'shipping',
            is_default: false
          });
        }
        
        // Check if we have a valid user with ID before fetching custom addresses
        return this.jwtAuthService.getUserAsObservable().pipe(
          switchMap(user => {
            if (!user || !user.id) {
              console.log('User missing ID, skipping custom addresses');
              return of(standardAddresses);
            }
            
            // Get custom addresses
            return this.addressService.getCustomAddresses().pipe(
              map(customAddresses => {
                // Combine standard and custom addresses
                return [...standardAddresses, ...customAddresses];
              }),
              catchError(error => {
                console.error('Error loading custom addresses:', error);
                // Return just the standard addresses if custom addresses fail to load
                return of(standardAddresses);
              })
            );
          })
        );
      }),
      tap(allAddresses => {
        // Update local cache
        this.allAddresses = allAddresses;
        this.initialized = true;
      }),
      catchError(error => {
        console.error('Error loading all addresses:', error);
        // Return empty array instead of throwing
        return of([]);
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
    // Check for valid user with ID before attempting to save address
    return this.jwtAuthService.getUserAsObservable().pipe(
      switchMap((user: User | null) => {
        if (!user || (user.id === undefined || user.id === null)) {
          console.error('Cannot save address: User not authenticated or missing ID');
          return throwError(() => new Error('User not authenticated'));
        }
        
        if ('address_nickname' in address && address.address_nickname) {
          // This is a custom address
          if (address.id && address.id !== 'billing' && address.id !== 'shipping') {
            // Update existing custom address
            return this.addressService.updateCustomAddress(address.id, address).pipe(
              tap(() => this.refreshAddresses()),
              catchError(error => {
                console.error('Error updating custom address:', error);
                return throwError(() => error);
              })
            );
          } else {
            // Create new custom address
            return this.addressService.addCustomAddress(address).pipe(
              tap(() => this.refreshAddresses()),
              catchError(error => {
                console.error('Error adding custom address:', error);
                return throwError(() => error);
              })
            );
          }
        } else {
          // This is a standard address (billing or shipping)
          const type = address.type as 'billing' | 'shipping';
          if (!type || !['billing', 'shipping'].includes(type)) {
            return throwError(() => new Error('Invalid address type. Must be "billing" or "shipping"'));
          }
          
          return this.addressService.updateAddress(type, address).pipe(
            tap(() => this.refreshAddresses()),
            catchError(error => {
              console.error(`Error updating ${type} address:`, error);
              return throwError(() => error);
            })
          );
        }
      })
    );
  }
  
  /**
   * Delete an address
   */
  deleteAddress(addressId: string | number): Observable<any> {
    if (addressId === 'billing' || addressId === 'shipping') {
      return throwError(() => new Error('Cannot delete primary billing or shipping addresses'));
    }
    
    // Check for valid user with ID before attempting to delete address
    return this.jwtAuthService.getUserAsObservable().pipe(
      switchMap((user: User | null) => {
        if (!user || (user.id === undefined || user.id === null)) {
          console.error('Cannot delete address: User not authenticated or missing ID');
          return throwError(() => new Error('User not authenticated'));
        }
        
        return this.addressService.deleteCustomAddress(addressId).pipe(
          tap(() => this.refreshAddresses()),
          catchError(error => {
            console.error('Error deleting address:', error);
            return throwError(() => error);
          })
        );
      })
    );
  }
  
  /**
   * Set an address as default for checkout
   */
  setDefaultAddress(addressId: string | number): Observable<any> {
    // Check for valid user with ID first
    return this.jwtAuthService.getUserAsObservable().pipe(
      switchMap((user: User | null) => {
        if (!user || (user.id === undefined || user.id === null)) {
          console.error('Cannot set default address: User not authenticated or missing ID');
          return throwError(() => new Error('User not authenticated'));
        }
        
        return this.getAddressById(addressId).pipe(
          switchMap(address => {
            if (!address) {
              console.error('Address not found with ID:', addressId);
              return throwError(() => new Error('Address not found'));
            }
            
            if (addressId === 'billing') {
              return this.addressService.updateAddress('billing', {
                ...address,
                is_default: true
              }).pipe(
                tap(() => this.refreshAddresses()),
                catchError(error => {
                  console.error('Error setting billing address as default:', error);
                  return throwError(() => error);
                })
              );
            } else if (addressId === 'shipping') {
              return this.addressService.updateAddress('shipping', {
                ...address,
                is_default: true
              }).pipe(
                tap(() => this.refreshAddresses()),
                catchError(error => {
                  console.error('Error setting shipping address as default:', error);
                  return throwError(() => error);
                })
              );
            } else {
              // For custom addresses, we need to copy it to either billing or shipping
              // Determine if this should be billing or shipping
              const type = address.type as 'billing' | 'shipping';
              if (!type || !['billing', 'shipping'].includes(type)) {
                console.error('Invalid address type for address with ID:', addressId);
                return throwError(() => new Error('Invalid address type'));
              }
              
              return this.addressService.updateAddress(type, {
                ...address,
                type,
                is_default: true
              }).pipe(
                tap(() => this.refreshAddresses()),
                catchError(error => {
                  console.error(`Error setting custom address as default ${type}:`, error);
                  return throwError(() => error);
                })
              );
            }
          })
        );
      })
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