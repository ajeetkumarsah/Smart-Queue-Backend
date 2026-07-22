export class BusinessEntity {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
