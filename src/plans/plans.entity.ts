export interface PlanEntity {
  id: string;
  name: string;
  code: string;
  price: number;
  period: string;
  features: any; // JSONB
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
