export class ServiceEntity {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  estimated_wait_time_mins: number;
  max_queue_size?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
