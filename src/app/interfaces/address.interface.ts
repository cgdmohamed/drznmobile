export interface Address {
  id: string;
  name: string;
  type: 'shipping' | 'billing';
  default: boolean;
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