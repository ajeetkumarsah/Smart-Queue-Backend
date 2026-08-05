import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';

@Injectable()
export class AdminService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async getPlatformStats() {
    const usersCountQuery = `SELECT COUNT(*) FROM users`;
    const businessesCountQuery = `SELECT COUNT(*) FROM businesses`;
    const queuesCountQuery = `SELECT COUNT(*) FROM service_queues WHERE status = 'ACTIVE'`;
    const subsCountQuery = `SELECT COUNT(*) FROM subscriptions WHERE is_active = true`;

    const [usersRes, businessesRes, queuesRes, subsRes] = await Promise.all([
      this.pool.query(usersCountQuery),
      this.pool.query(businessesCountQuery),
      this.pool.query(queuesCountQuery),
      this.pool.query(subsCountQuery),
    ]);

    return {
      total_users: parseInt(usersRes.rows[0].count, 10),
      total_businesses: parseInt(businessesRes.rows[0].count, 10),
      active_queues: parseInt(queuesRes.rows[0].count, 10),
      active_subscriptions: parseInt(subsRes.rows[0].count, 10),
    };
  }

  async getAllUsers(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT id, email, full_name, role, phone_number, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countQuery = `SELECT COUNT(*) FROM users`;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(query, [limit, offset]),
      this.pool.query(countQuery),
    ]);

    return {
      data: dataRes.rows,
      meta: {
        total: parseInt(countRes.rows[0].count, 10),
        page,
        limit,
      },
    };
  }

  async getAllBusinesses(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT b.id, b.name, b.email, b.phone, b.is_verified, b.created_at, u.full_name as owner_name
      FROM businesses b
      JOIN users u ON b.owner_id = u.id
      ORDER BY b.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countQuery = `SELECT COUNT(*) FROM businesses`;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(query, [limit, offset]),
      this.pool.query(countQuery),
    ]);

    return {
      data: dataRes.rows,
      meta: {
        total: parseInt(countRes.rows[0].count, 10),
        page,
        limit,
      },
    };
  }

  async verifyBusiness(businessId: string, verify: boolean) {
    const query = `
      UPDATE businesses
      SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, is_verified
    `;
    const res = await this.pool.query(query, [verify, businessId]);
    if (res.rowCount === 0) {
      throw new NotFoundException('Business not found');
    }
    return res.rows[0];
  }

  async getAllSubscriptions(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT s.id, s.plan_type, s.start_date, s.end_date, s.is_active, u.full_name, u.email
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countQuery = `SELECT COUNT(*) FROM subscriptions`;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(query, [limit, offset]),
      this.pool.query(countQuery),
    ]);

    return {
      data: dataRes.rows,
      meta: {
        total: parseInt(countRes.rows[0].count, 10),
        page,
        limit,
      },
    };
  }
}
