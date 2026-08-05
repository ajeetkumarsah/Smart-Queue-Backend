import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { SubscriptionEntity } from './subscriptions.entity';

@Injectable()
export class SubscriptionsRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async findActiveByUserId(userId: string): Promise<SubscriptionEntity | null> {
    const text = `
      SELECT * FROM subscriptions
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const res = await this.pool.query(text, [userId]);
    return res.rows[0] || null;
  }

  async create(userId: string, planType: string): Promise<SubscriptionEntity> {
    // End date calculation (mock for 1 month or 1 year)
    const endDate = new Date();
    if (planType === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const text = `
      INSERT INTO subscriptions (user_id, plan_type, end_date, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `;
    const res = await this.pool.query(text, [userId, planType, endDate]);
    return res.rows[0];
  }
}
