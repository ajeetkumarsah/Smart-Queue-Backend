export interface SubscriptionEntity {
  id: string;
  user_id: string;
  plan_type: string;
  start_date: Date;
  end_date: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
