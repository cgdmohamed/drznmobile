export interface Address {
  id?: string;                // Optional for API response
  name?: string;              // User-friendly name for this address
  type?: 'shipping' | 'billing';
  is_default?: boolean;
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

// API Response format
export interface AddressResponse {
  billing: Address;
  shipping: Address;
}