export interface UserEntity {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  avatar_url?: string;
  refresh_token?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
