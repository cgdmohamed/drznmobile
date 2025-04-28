export interface Address {
  id?: string | number;       // Optional for API response, can be string or number
  name?: string;              // User-friendly name for this address
  type?: 'shipping' | 'billing' | string; // Allow string for type flexibility
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
  address_nickname?: string;  // For custom addresses
}

// API Response format
export interface AddressResponse {
  billing: Address;
  shipping: Address;
}