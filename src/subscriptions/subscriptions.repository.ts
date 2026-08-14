import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { SubscriptionEntity } from './subscriptions.entity';
import { PG_CONNECTION } from '../database/database.constants';

@Injectable()
export class SubscriptionsRepository {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findActiveByUserId(userId: string): Promise<SubscriptionEntity | null> {
    const text = `
      SELECT * FROM subscriptions
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    const res = await this.pool.query(text, [userId]);
    return res.rows[0] || null;
  }

  async findPlanByCode(code: string): Promise<any> {
    const text = `
      SELECT * FROM plans
      WHERE code = $1 AND is_active = true
      LIMIT 1
    `;
    const res = await this.pool.query(text, [code]);
    return res.rows[0] || null;
  }

  async findExpiringIn(days: number): Promise<SubscriptionEntity[]> {
    const text = `
      SELECT * FROM subscriptions
      WHERE is_active = true
        AND end_date IS NOT NULL
        AND end_date::date = (CURRENT_DATE + $1 * interval '1 day')::date
    `;
    const res = await this.pool.query(text, [days]);
    return res.rows;
  }

  async findExpired(): Promise<SubscriptionEntity[]> {
    const text = `
      SELECT * FROM subscriptions
      WHERE is_active = true
        AND end_date IS NOT NULL
        AND end_date < CURRENT_TIMESTAMP
    `;
    const res = await this.pool.query(text);
    return res.rows;
  }

  async deactivateOldSubscriptions(userId: string): Promise<void> {
    const text = `
      UPDATE subscriptions
      SET is_active = false
      WHERE user_id = $1 AND is_active = true
    `;
    await this.pool.query(text, [userId]);
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

  async createTransaction(
    userId: string,
    planType: string,
    amount: number,
    currency: string,
    orderId: string,
  ): Promise<void> {
    const text = `
      INSERT INTO transactions (user_id, plan_type, amount, currency, order_id, status)
      VALUES ($1, $2, $3, $4, $5, 'INITIATED')
    `;
    await this.pool.query(text, [userId, planType, amount, currency, orderId]);
  }

  async updateTransactionStatus(
    orderId: string,
    status: string,
    paymentId?: string,
  ): Promise<void> {
    const text = `
      UPDATE transactions
      SET status = $1, payment_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = $3
    `;
    await this.pool.query(text, [status, paymentId || null, orderId]);
  }
}
