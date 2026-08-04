export interface NotificationEntity {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  type?: string;
  created_at: Date;
  updated_at: Date;
}
