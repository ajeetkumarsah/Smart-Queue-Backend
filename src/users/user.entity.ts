export interface UserEntity {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
