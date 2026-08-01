export class BusinessEntity {
  id: string;
  owner_id: string;
  name: string;
  category?: string;
  description?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  is_active: boolean;
  is_verified: boolean;
  // Computed / joined fields
  owner_name?: string;
  avg_rating?: number;
  review_count?: number;
  services?: Record<string, unknown>[];
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
