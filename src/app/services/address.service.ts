import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Address, AddressResponse } from '../interfaces/address.interface';
import { environment } from '../../environments/environment';
import { JwtAuthService } from './jwt-auth.service';

/**
 * Interface for custom addresses (already included in the Address interface)
 */
export type CustomAddress = Address;

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private apiUrl = environment.apiUrl;
  private apiPrefix = '/wp-json/wc/v3';
  
  // Cache for addresses
  private _addresses: AddressResponse | null = null;
  private _customAddresses: CustomAddress[] = [];
  
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
      console.log('User not authenticated, skipping address loading');
      return;
    }
    
    this.fetchAddresses().subscribe(
      addresses => {
        console.log('Successfully loaded addresses on init:', addresses);
        this._addresses = addresses;
      },
      error => {
        console.error('Failed to load addresses on initialization:', error);
      }
    );
    
    this.fetchCustomAddresses().subscribe(
      addresses => {
        console.log('Successfully loaded custom addresses on init:', addresses);
        this._customAddresses = addresses;
      },
      error => {
        console.error('Failed to load custom addresses on initialization:', error);
      }
    );
  }
  
  /**
   * Get all addresses for the current user (billing, shipping, and custom)
   */
  getAddresses(): Observable<AddressResponse> {
    if (this._addresses) {
      console.log('Returning cached addresses:', this._addresses);
      return of(this._addresses);
    }
    
    console.log('No cached addresses, fetching from API');
    return this.fetchAddresses().pipe(
      map(addresses => {
        this._addresses = addresses;
        return addresses;
      })
    );
  }
  
  /**
   * Get all custom addresses for the current user
   */
  getCustomAddresses(): Observable<CustomAddress[]> {
    if (this._customAddresses && this._customAddresses.length > 0) {
      console.log('Returning cached custom addresses:', this._customAddresses);
      return of(this._customAddresses);
    }
    
    console.log('No cached custom addresses, fetching from API');
    return this.fetchCustomAddresses();
  }
  
  /**
   * Fetch billing and shipping addresses from the API
   */
  private fetchAddresses(): Observable<AddressResponse> {
    console.log('Attempting to fetch billing and shipping addresses');
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        console.log('User from JWT service:', user);
        if (!user || !user.id) {
          console.error('User not authenticated or missing ID');
          return throwError(() => new Error('User not authenticated'));
        }
        
        // According to your Postman collection, use this URL format
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses`;
        console.log('Fetching addresses from URL:', url);
        
        return this.http.get<AddressResponse>(url).pipe(
          map(response => {
            console.log('Address response from API:', response);
            return response;
          }),
          catchError(error => {
            console.error('Error fetching addresses:', error);
            // For debugging only - fallback to user's billing and shipping from their profile
            if (user.billing && user.shipping) {
              console.log('Using fallback addresses from user profile');
              return of({
                billing: user.billing,
                shipping: user.shipping
              } as AddressResponse);
            }
            return throwError(() => new Error('Failed to retrieve addresses'));
          })
        );
      })
    );
  }
  
  /**
   * Fetch custom addresses from the API
   */
  private fetchCustomAddresses(): Observable<CustomAddress[]> {
    console.log('Attempting to fetch custom addresses');
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        console.log('User from JWT service for custom addresses:', user);
        if (!user || !user.id) {
          console.error('User not authenticated or missing ID');
          return throwError(() => new Error('User not authenticated'));
        }
        
        // According to your Postman collection, use this URL format for custom addresses
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses/my-addresses`;
        console.log('Fetching custom addresses from URL:', url);
        
        return this.http.get<CustomAddress[]>(url).pipe(
          map(response => {
            console.log('Custom address response from API:', response);
            return response;
          }),
          catchError(error => {
            console.error('Error fetching custom addresses:', error);
            // Return empty array on error
            return of([]);
          })
        );
      })
    );
  }

  /**
   * Get a specific address (billing or shipping)
   */
  getAddress(type: 'billing' | 'shipping'): Observable<Address> {
    if (this._addresses && this._addresses[type]) {
      console.log(`Returning cached ${type} address:`, this._addresses[type]);
      return of(this._addresses[type]);
    }
    
    console.log(`No cached ${type} address, fetching from API`);
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses/${type}`;
        console.log(`Fetching ${type} address from URL:`, url);
        
        return this.http.get<Address>(url).pipe(
          tap(address => {
            console.log(`Fetched ${type} address:`, address);
            // Update cache
            if (this._addresses) {
              this._addresses[type] = address;
            } else {
              this._addresses = {} as AddressResponse;
              this._addresses[type] = address;
            }
          }),
          catchError(error => {
            console.error(`Error fetching ${type} address:`, error);
            return throwError(() => new Error(`Failed to retrieve ${type} address`));
          })
        );
      })
    );
  }

  /**
   * Update an existing address (billing or shipping)
   */
  updateAddress(type: 'billing' | 'shipping', address: Address): Observable<any> {
    console.log(`Updating ${type} address:`, address);
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses/${type}`;
        console.log(`Updating ${type} address at URL:`, url);
        
        return this.http.post<any>(url, address).pipe(
          tap(response => {
            console.log(`Updated ${type} address, response:`, response);
            // Update local cache after successful update
            if (this._addresses) {
              this._addresses[type] = address;
            } else {
              this._addresses = {} as AddressResponse;
              this._addresses[type] = address;
            }
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
   * Update an existing custom address
   */
  updateCustomAddress(addressId: string | number, address: CustomAddress): Observable<any> {
    console.log(`Updating custom address with ID ${addressId}:`, address);
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses/my-addresses/${addressId}`;
        console.log(`Updating custom address at URL:`, url);
        
        return this.http.put<any>(url, address).pipe(
          tap(response => {
            console.log(`Updated custom address, response:`, response);
            // Update local cache after successful update
            const index = this._customAddresses.findIndex(a => a.id === addressId);
            if (index !== -1) {
              this._customAddresses[index] = { ...address, id: addressId };
            }
          }),
          catchError(error => {
            console.error(`Error updating custom address:`, error);
            return throwError(() => new Error(`Failed to update custom address`));
          })
        );
      })
    );
  }

  /**
   * Add a new address (billing or shipping)
   */
  addAddress(address: Address): Observable<any> {
    console.log(`Adding new address:`, address);
    if (!address.type || !['billing', 'shipping'].includes(address.type)) {
      return throwError(() => new Error('Invalid address type. Must be "billing" or "shipping"'));
    }
    
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        const type = address.type;
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses/${type}`;
        console.log(`Adding ${type} address at URL:`, url);
        
        return this.http.post<any>(url, address).pipe(
          tap(response => {
            console.log(`Added ${type} address, response:`, response);
            // Update local cache after successful creation
            if (this._addresses && type) {
              this._addresses[type] = address;
            } else if (type) {
              this._addresses = {} as AddressResponse;
              this._addresses[type] = address;
            }
          }),
          catchError(error => {
            console.error(`Error adding ${type} address:`, error);
            return throwError(() => new Error(`Failed to add ${type} address`));
          })
        );
      })
    );
  }
  
  /**
   * Add a new custom address
   */
  addCustomAddress(address: CustomAddress): Observable<any> {
    console.log(`Adding new custom address:`, address);
    
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses/my-addresses`;
        console.log(`Adding custom address at URL:`, url);
        
        return this.http.post<any>(url, address).pipe(
          tap(response => {
            console.log(`Added custom address, response:`, response);
            // Update local cache after successful creation
            if (response && response.id) {
              const newAddress = { ...address, id: response.id };
              this._customAddresses.push(newAddress);
            }
          }),
          catchError(error => {
            console.error(`Error adding custom address:`, error);
            return throwError(() => new Error(`Failed to add custom address`));
          })
        );
      })
    );
  }

  /**
   * Delete a custom address
   */
  deleteCustomAddress(addressId: string | number): Observable<any> {
    console.log(`Deleting custom address with ID ${addressId}`);
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        const url = `${this.apiUrl}${this.apiPrefix}/customers/${user.id}/addresses/my-addresses/${addressId}`;
        console.log(`Deleting custom address at URL:`, url);
        
        return this.http.delete<any>(url).pipe(
          tap(response => {
            console.log(`Deleted custom address, response:`, response);
            // Update local cache after successful deletion
            const index = this._customAddresses.findIndex(a => a.id === addressId);
            if (index !== -1) {
              this._customAddresses.splice(index, 1);
            }
          }),
          catchError(error => {
            console.error(`Error deleting custom address:`, error);
            return throwError(() => new Error(`Failed to delete custom address`));
          })
        );
      })
    );
  }
  
  /**
   * Delete an address (backward compatibility method)
   * For standard addresses, this just clears them
   * For custom addresses, this removes them completely
   */
  deleteAddress(type: string): Observable<any> {
    console.log(`Delete address of type ${type}`);
    
    if (type === 'billing' || type === 'shipping') {
      // For billing/shipping, we just clear the fields
      return from(this.jwtAuthService.getUser()).pipe(
        switchMap(user => {
          if (!user || !user.id) {
            return throwError(() => new Error('User not authenticated'));
          }
          
          // Create an empty address to replace the current one
          const emptyAddress: Address = {
            type: type as 'billing' | 'shipping',
            first_name: '',
            last_name: '',
            address_1: '',
            city: '',
            state: '',
            postcode: '',
            country: 'SA',
            email: user.email || ''
          };
          
          return this.updateAddress(type as 'billing' | 'shipping', emptyAddress);
        })
      );
    } else {
      // For custom addresses, perform a real deletion
      return this.deleteCustomAddress(type);
    }
  }
  
  /**
   * Set an address as default
   */
  setDefaultAddress(type: string): Observable<any> {
    console.log(`Set address of type ${type} as default`);
    
    return from(this.jwtAuthService.getUser()).pipe(
      switchMap(user => {
        if (!user || !user.id) {
          return throwError(() => new Error('User not authenticated'));
        }
        
        if (type === 'billing' || type === 'shipping') {
          // Get the current address and ensure is_default is set
          return this.getAddress(type as 'billing' | 'shipping').pipe(
            switchMap(address => {
              address.is_default = true;
              return this.updateAddress(type as 'billing' | 'shipping', address);
            })
          );
        } else {
          // For custom addresses, we need to:
          // 1. Get the custom address
          // 2. Determine if it's a billing or shipping type
          // 3. Copy it to the appropriate standard address
          const customAddressIndex = this._customAddresses.findIndex(a => a.id === type);
          if (customAddressIndex !== -1) {
            const customAddress = this._customAddresses[customAddressIndex];
            const addressType = customAddress.type as 'billing' | 'shipping' || 'shipping';
            
            // Copy the custom address to the standard address
            return this.updateAddress(addressType, {
              ...customAddress,
              type: addressType,
              is_default: true
            });
          }
          
          return throwError(() => new Error(`Custom address with ID ${type} not found`));
        }
      })
    );
  }
  
  /**
   * Clear cache and reload all addresses
   */
  refreshAddresses(): Observable<any> {
    console.log('Refreshing all addresses');
    this._addresses = null;
    this._customAddresses = [];
    
    return this.fetchAddresses().pipe(
      switchMap(addresses => {
        this._addresses = addresses;
        
        return this.fetchCustomAddresses().pipe(
          map(customAddresses => {
            this._customAddresses = customAddresses;
            return { addresses, customAddresses };
          })
        );
      })
    );
  }
}