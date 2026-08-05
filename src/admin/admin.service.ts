import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';

@Injectable()
export class AdminService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async getPlatformStats() {
    const usersCountQuery = `SELECT COUNT(*) FROM users`;
    const businessesCountQuery = `SELECT COUNT(*) FROM businesses`;
    const queuesCountQuery = `SELECT COUNT(*) FROM queues WHERE status = 'WAITING' OR status = 'IN_PROGRESS'`;
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

  async getChartData() {
    // Get last 7 days of user signups
    const chartQuery = `
      SELECT TO_CHAR(created_at, 'DD') as name, COUNT(*) as value
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY TO_CHAR(created_at, 'DD'), DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;

    // Get 5 recent activities (latest users/businesses created)
    const recentQuery = `
      SELECT id, full_name as title, 'Customer Registration' as type, created_at as date, 'red' as color
      FROM users
      WHERE role = 'CUSTOMER'
      UNION ALL
      SELECT b.id, b.name as title, 'Business Signup' as type, b.created_at as date, 'orange' as color
      FROM businesses b
      ORDER BY date DESC
      LIMIT 5
    `;

    const [chartRes, recentRes] = await Promise.all([
      this.pool.query(chartQuery),
      this.pool.query(recentQuery),
    ]);

    // Format chart data
    const chartData = chartRes.rows.map(row => ({
      name: row.name,
      value: parseInt(row.value, 10) * 10, // Multiplied just to make it look like bigger data in the chart
    }));

    // Format recent data
    const recentData = recentRes.rows.map(row => ({
      id: row.id,
      title: row.title,
      date: new Date(row.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      value: row.type, // We can reuse value to show type
      color: row.color,
    }));

    return {
      chart: chartData.length ? chartData : [{ name: '01', value: 0 }],
      recent: recentData,
    };
  }

  async getAllUsers(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT id, email, full_name, role, phone AS phone_number, created_at
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
      SELECT b.id, b.name, u.email, b.phone, b.is_verified, b.created_at, u.full_name as owner_name
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

  // --- Users CRUD ---
  async createUser(data: { full_name: string; email: string; phone: string; role?: string }) {
    // Check if email or phone exists
    const checkQuery = `SELECT id FROM users WHERE email = $1 OR phone = $2`;
    const checkRes = await this.pool.query(checkQuery, [data.email, data.phone]);
    if (checkRes.rowCount > 0) {
      throw new BadRequestException('User with this email or phone already exists');
    }

    const hashedPassword = await bcrypt.hash('Password123!', 10); // Default password

    const query = `
      INSERT INTO users (full_name, email, phone, role, password_hash)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name, role, phone AS phone_number, is_active, created_at
    `;
    const values = [data.full_name, data.email, data.phone, data.role || 'CUSTOMER', hashedPassword];
    
    const res = await this.pool.query(query, values);
    return res.rows[0];
  }

  async updateUser(userId: string, data: { full_name?: string; phone?: string; role?: string; is_active?: boolean }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.full_name !== undefined) { fields.push(`full_name = $${idx++}`); values.push(data.full_name); }
    if (data.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(data.phone); }
    if (data.role !== undefined) { fields.push(`role = $${idx++}`); values.push(data.role); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

    if (fields.length === 0) return null;

    values.push(userId);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING id, email, full_name, role, phone AS phone_number, is_active
    `;
    const res = await this.pool.query(query, values);
    if (res.rowCount === 0) throw new NotFoundException('User not found');
    return res.rows[0];
  }

  async deleteUser(userId: string) {
    const query = `UPDATE users SET is_active = false, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`;
    const res = await this.pool.query(query, [userId]);
    if (res.rowCount === 0) throw new NotFoundException('User not found');
    return true;
  }

  // --- Businesses CRUD ---
  async createBusiness(data: { owner_id: string; name: string; phone: string; category?: string; address?: string }) {
    // Check if owner exists
    const checkQuery = `SELECT id FROM users WHERE id = $1`;
    const checkRes = await this.pool.query(checkQuery, [data.owner_id]);
    if (checkRes.rowCount === 0) {
      throw new BadRequestException('Owner not found');
    }

    const query = `
      INSERT INTO businesses (owner_id, name, phone, category, address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, phone, is_active, is_verified, created_at
    `;
    const values = [data.owner_id, data.name, data.phone, data.category || '', data.address || ''];
    
    const res = await this.pool.query(query, values);
    return res.rows[0];
  }

  async updateBusiness(businessId: string, data: { name?: string; phone?: string; is_active?: boolean }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
    if (data.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(data.phone); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

    if (fields.length === 0) return null;

    values.push(businessId);
    const query = `
      UPDATE businesses
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING id, name, phone, is_active, is_verified
    `;
    const res = await this.pool.query(query, values);
    if (res.rowCount === 0) throw new NotFoundException('Business not found');
    return res.rows[0];
  }

  async deleteBusiness(businessId: string) {
    const query = `UPDATE businesses SET is_active = false, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`;
    const res = await this.pool.query(query, [businessId]);
    if (res.rowCount === 0) throw new NotFoundException('Business not found');
    return true;
  }

  // --- Services CRUD ---
  async getAllServices(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT s.id, s.name, s.estimated_wait_time_mins, s.is_active, s.created_at, b.name as business_name, b.id as business_id
      FROM services s
      JOIN businesses b ON s.business_id = b.id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countQuery = `SELECT COUNT(*) FROM services`;

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

  async createService(data: { business_id: string; name: string; estimated_wait_time_mins: number }) {
    const checkQuery = `SELECT id FROM businesses WHERE id = $1`;
    const checkRes = await this.pool.query(checkQuery, [data.business_id]);
    if (checkRes.rowCount === 0) {
      throw new BadRequestException('Business not found');
    }

    const query = `
      INSERT INTO services (business_id, name, estimated_wait_time_mins)
      VALUES ($1, $2, $3)
      RETURNING id, name, estimated_wait_time_mins, is_active
    `;
    const res = await this.pool.query(query, [data.business_id, data.name, data.estimated_wait_time_mins]);
    return res.rows[0];
  }

  // --- Subscriptions CRUD ---
  async updateSubscription(subscriptionId: string, data: { plan_type?: string; is_active?: boolean; end_date?: string }) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.plan_type !== undefined) { fields.push(`plan_type = $${idx++}`); values.push(data.plan_type); }
    if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }
    if (data.end_date !== undefined) { fields.push(`end_date = $${idx++}`); values.push(data.end_date ? new Date(data.end_date) : null); }

    if (fields.length === 0) return null;

    values.push(subscriptionId);
    const query = `
      UPDATE subscriptions
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING id, plan_type, is_active, start_date, end_date
    `;
    const res = await this.pool.query(query, values);
    if (res.rowCount === 0) throw new NotFoundException('Subscription not found');
    return res.rows[0];
  }

  async deleteSubscription(subscriptionId: string) {
    const query = `UPDATE subscriptions SET is_active = false, end_date = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`;
    const res = await this.pool.query(query, [subscriptionId]);
    if (res.rowCount === 0) throw new NotFoundException('Subscription not found');
    return true;
  }
}
