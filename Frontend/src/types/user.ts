export interface UserAddress {
  id: string;
  label: string; // 'Home' | 'Work' | 'Other'
  name: string;
  phone: string;
  /** The number was verified: it cannot be changed (the rest of the address can) */
  phone_verified?: boolean;
  address_line: string;
  city: string;
  pincode: string;
  is_default: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: 'buyer' | 'superadmin';
  address_line?: string;
  city?: string;
  pincode?: string;
  addresses?: UserAddress[];
  is_verified?: boolean;
  is_phone_verified?: boolean;
  phone_verified_at?: string;
  password?: string;
}
