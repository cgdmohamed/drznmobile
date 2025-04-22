import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { User } from '../interfaces/user.interface';
import { Address } from '../interfaces/address.interface';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class AddressService {
  private _addresses = new BehaviorSubject<Address[]>([]);
  private readonly ADDRESSES_STORAGE_KEY = 'user_addresses';

  constructor(
    private authService: AuthService,
    private storage: Storage
  ) {
    this.initialize();
  }

  /**
   * Initialize the address service
   * Loads addresses from storage or user data
   */
  async initialize() {
    await this.loadAddresses();

    // Subscribe to user changes to update addresses
    this.authService.user.subscribe(user => {
      if (user) {
        this.syncAddressesWithUser(user);
      } else {
        this._addresses.next([]);
      }
    });
  }

  /**
   * Get addresses as an observable
   */
  get addresses(): Observable<Address[]> {
    return this._addresses.asObservable();
  }

  /**
   * Get current value of addresses
   */
  get addressesValue(): Address[] {
    return this._addresses.getValue();
  }

  /**
   * Get shipping addresses
   */
  getShippingAddresses(): Observable<Address[]> {
    return this.addresses.pipe(
      map(addresses => addresses.filter(address => address.type === 'shipping'))
    );
  }

  /**
   * Get billing addresses
   */
  getBillingAddresses(): Observable<Address[]> {
    return this.addresses.pipe(
      map(addresses => addresses.filter(address => address.type === 'billing'))
    );
  }

  /**
   * Get default shipping address
   */
  getDefaultShippingAddress(): Observable<Address | undefined> {
    return this.getShippingAddresses().pipe(
      map(addresses => addresses.find(address => address.default))
    );
  }

  /**
   * Get default billing address
   */
  getDefaultBillingAddress(): Observable<Address | undefined> {
    return this.getBillingAddresses().pipe(
      map(addresses => addresses.find(address => address.default))
    );
  }

  /**
   * Add a new address
   * @param address The address to add
   */
  addAddress(address: Omit<Address, 'id'>): Observable<Address[]> {
    const newAddress: Address = {
      ...address,
      id: `${address.type}_${Date.now()}`
    };

    // If this is the first address of its type, make it default
    if (!this.addressesValue.some(a => a.type === address.type)) {
      newAddress.default = true;
    }

    const updatedAddresses = [...this.addressesValue, newAddress];
    this._addresses.next(updatedAddresses);

    return from(this.saveAddresses()).pipe(
      map(() => updatedAddresses)
    );
  }

  /**
   * Update an existing address
   * @param id ID of the address to update
   * @param addressData Updated address data
   */
  updateAddress(id: string, addressData: Partial<Address>): Observable<Address[]> {
    const addresses = this.addressesValue;
    const index = addresses.findIndex(a => a.id === id);

    if (index === -1) {
      return this.addresses;
    }

    const updatedAddresses = [...addresses];
    updatedAddresses[index] = {
      ...updatedAddresses[index],
      ...addressData
    };

    this._addresses.next(updatedAddresses);

    return from(this.saveAddresses()).pipe(
      map(() => updatedAddresses)
    );
  }

  /**
   * Delete an address
   * @param id ID of the address to delete
   */
  deleteAddress(id: string): Observable<Address[]> {
    const addresses = this.addressesValue;
    const address = addresses.find(a => a.id === id);

    if (!address || address.default) {
      // Can't delete default address
      return this.addresses;
    }

    const updatedAddresses = addresses.filter(a => a.id !== id);
    this._addresses.next(updatedAddresses);

    return from(this.saveAddresses()).pipe(
      map(() => updatedAddresses)
    );
  }

  /**
   * Set an address as default for its type
   * @param id ID of the address to set as default
   */
  setDefaultAddress(id: string): Observable<Address[]> {
    const addresses = this.addressesValue;
    const address = addresses.find(a => a.id === id);

    if (!address) {
      return this.addresses;
    }

    const updatedAddresses = addresses.map(a => ({
      ...a,
      default: a.id === id ? true : (a.type === address.type ? false : a.default)
    }));

    this._addresses.next(updatedAddresses);

    return from(this.saveAddresses()).pipe(
      switchMap(() => {
        // Update user's default shipping/billing info
        return this.syncDefaultAddressWithUser(address).pipe(
          map(() => updatedAddresses)
        );
      })
    );
  }

  /**
   * Sync default address with the user's profile
   * @param address The address to sync
   */
  private syncDefaultAddressWithUser(address: Address): Observable<any> {
    if (!this.authService.isLoggedIn) {
      return from(Promise.resolve());
    }

    const user = this.authService.userValue;
    if (!user) {
      return from(Promise.resolve());
    }

    const addressType = address.type;
    const userData: Partial<User> = {};

    if (addressType === 'shipping') {
      userData.shipping = {
        first_name: address.first_name,
        last_name: address.last_name,
        company: address.company || '',
        address_1: address.address_1,
        address_2: address.address_2 || '',
        city: address.city,
        state: address.state,
        postcode: address.postcode,
        country: address.country
      };
    } else if (addressType === 'billing') {
      userData.billing = {
        first_name: address.first_name,
        last_name: address.last_name,
        company: address.company || '',
        address_1: address.address_1,
        address_2: address.address_2 || '',
        city: address.city,
        state: address.state,
        postcode: address.postcode,
        country: address.country,
        email: address.email || user.email,
        phone: address.phone || ''
      };
    }

    return this.authService.updateUserProfile(userData);
  }

  /**
   * Save addresses to storage and sync with user metadata
   */
  private async saveAddresses(): Promise<void> {
    const addresses = this.addressesValue;

    // Save to storage
    await this.storage.set(this.ADDRESSES_STORAGE_KEY, addresses);

    // Save to user metadata if logged in
    if (this.authService.isLoggedIn && this.authService.userValue) {
      await this.syncAddressesWithUserMetadata();
    }
  }

  /**
   * Load addresses from storage or user data
   */
  private async loadAddresses(): Promise<void> {
    // Check storage first
    const storedAddresses = await this.storage.get(this.ADDRESSES_STORAGE_KEY);

    if (storedAddresses && Array.isArray(storedAddresses) && storedAddresses.length > 0) {
      this._addresses.next(storedAddresses);
      return;
    }

    // If no addresses in storage and user is logged in, try to load from user data
    if (this.authService.isLoggedIn && this.authService.userValue) {
      this.syncAddressesWithUser(this.authService.userValue);
    }
  }

  /**
   * Sync addresses with user data
   * @param user The user to sync addresses with
   */
  private syncAddressesWithUser(user: User): void {
    // First check for saved addresses in metadata
    const savedAddresses = user.meta_data?.find(meta => meta.key === 'saved_addresses')?.value;
    
    if (savedAddresses && Array.isArray(savedAddresses) && savedAddresses.length > 0) {
      this._addresses.next(savedAddresses);
      return;
    }

    // If no saved addresses in metadata, create from user billing/shipping
    const addresses: Address[] = [];
    
    if (this.hasAddressInfo(user.billing)) {
      addresses.push({
        id: 'billing_default',
        name: 'عنوان الفواتير الافتراضي',
        type: 'billing',
        default: true,
        ...user.billing
      });
    }
    
    if (this.hasAddressInfo(user.shipping) && 
        !(user.shipping.address_1 === user.billing.address_1 && 
          user.shipping.city === user.billing.city)) {
      addresses.push({
        id: 'shipping_default',
        name: 'عنوان الشحن الافتراضي',
        type: 'shipping',
        default: true,
        ...user.shipping,
        email: user.email,
        phone: user.billing.phone
      });
    }
    
    this._addresses.next(addresses);
    this.saveAddresses();
  }

  /**
   * Sync addresses with user metadata
   */
  private async syncAddressesWithUserMetadata(): Promise<void> {
    if (!this.authService.isLoggedIn || !this.authService.userValue) {
      return;
    }

    const user = this.authService.userValue;
    const addresses = this.addressesValue;
    const metadata = user.meta_data || [];
    
    const existingIndex = metadata.findIndex(meta => meta.key === 'saved_addresses');
    
    let updatedMetadata;
    if (existingIndex !== -1) {
      updatedMetadata = [...metadata];
      updatedMetadata[existingIndex] = {
        ...updatedMetadata[existingIndex],
        value: addresses
      };
    } else {
      updatedMetadata = [
        ...metadata,
        {
          id: 0,
          key: 'saved_addresses',
          value: addresses
        }
      ];
    }
    
    const userData: Partial<User> = {
      meta_data: updatedMetadata
    };
    
    try {
      await this.authService.updateUserProfile(userData).toPromise();
    } catch (error) {
      console.error('Error saving addresses to user metadata:', error);
    }
  }

  /**
   * Check if an address object has required info
   * @param address The address to check
   */
  private hasAddressInfo(address: any): boolean {
    return address && 
           address.address_1 && 
           address.city && 
           address.state && 
           address.postcode;
  }
}