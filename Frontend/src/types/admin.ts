export type AdminRole = 'superadmin' | 'admin' | 'editor';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  link_url: string;
  cta_text?: string;
  badge?: string;
  is_active: boolean;
  display_order: number;
  created_at?: string;
}
