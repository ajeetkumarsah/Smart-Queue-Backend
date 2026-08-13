export interface PlanEntity {
  id: string;
  name: string;
  code: string;
  price: number;
  period: string;
  features: any; // JSONB
  is_active: boolean;
  has_tag?: boolean;
  tag_text?: string;
  description?: string;
  original_price?: number;
  created_at: Date;
  updated_at: Date;
}
