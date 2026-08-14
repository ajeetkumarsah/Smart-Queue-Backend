import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';

@Injectable()
export class AdminService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  private async logAudit(
    action: string,
    entityType: string,
    entityId: string,
    oldData: any = null,
    newData: any = null,
  ) {
    try {
      const query = `
        INSERT INTO audit_logs (action, entity_type, entity_id, old_data, new_data)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await this.pool.query(query, [action, entityType, entityId, oldData, newData]);
    } catch (err) {
      console.error('Failed to log audit:', err);
    }
  }

  private calculateGrowth(cur: number, prev: number): number {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }

  async getPlatformStats() {
    const usersQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as cur_30,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '30 days') as prev_30,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as cur_7,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days') as prev_7
      FROM users
    `;
    const businessesQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as cur_30,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '30 days') as prev_30,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as cur_7,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days') as prev_7
      FROM businesses
    `;
    const queuesQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'WAITING' OR status = 'IN_PROGRESS') as total,
        COUNT(*) FILTER (WHERE joined_at >= CURRENT_DATE - INTERVAL '30 days') as cur_30,
        COUNT(*) FILTER (WHERE joined_at >= CURRENT_DATE - INTERVAL '60 days' AND joined_at < CURRENT_DATE - INTERVAL '30 days') as prev_30,
        COUNT(*) FILTER (WHERE joined_at >= CURRENT_DATE - INTERVAL '7 days') as cur_7,
        COUNT(*) FILTER (WHERE joined_at >= CURRENT_DATE - INTERVAL '14 days' AND joined_at < CURRENT_DATE - INTERVAL '7 days') as prev_7
      FROM queues
    `;
    const subsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true) as total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as cur_30,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '30 days') as prev_30,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as cur_7,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days') as prev_7
      FROM subscriptions
    `;
    const revenueQuery = `
      SELECT 
        SUM(amount) FILTER (WHERE status = 'SUCCESS') as total,
        SUM(amount) FILTER (WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as cur_30,
        SUM(amount) FILTER (WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE - INTERVAL '60 days' AND created_at < CURRENT_DATE - INTERVAL '30 days') as prev_30,
        SUM(amount) FILTER (WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE - INTERVAL '7 days') as cur_7,
        SUM(amount) FILTER (WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE - INTERVAL '14 days' AND created_at < CURRENT_DATE - INTERVAL '7 days') as prev_7
      FROM transactions
    `;

    const [usersRes, businessesRes, queuesRes, subsRes, revenueRes] = await Promise.all([
      this.pool.query(usersQuery),
      this.pool.query(businessesQuery),
      this.pool.query(queuesQuery),
      this.pool.query(subsQuery),
      this.pool.query(revenueQuery),
    ]);

    const u = usersRes.rows[0];
    const b = businessesRes.rows[0];
    const q = queuesRes.rows[0];
    const s = subsRes.rows[0];
    const r = revenueRes.rows[0];

    return {
      total_users: parseInt(u.total, 10) || 0,
      users_trend: this.calculateGrowth(parseInt(u.cur_30, 10) || 0, parseInt(u.prev_30, 10) || 0),
      users_percentage: this.calculateGrowth(parseInt(u.cur_7, 10) || 0, parseInt(u.prev_7, 10) || 0),

      total_businesses: parseInt(b.total, 10) || 0,
      businesses_trend: this.calculateGrowth(parseInt(b.cur_30, 10) || 0, parseInt(b.prev_30, 10) || 0),
      businesses_percentage: this.calculateGrowth(parseInt(b.cur_7, 10) || 0, parseInt(b.prev_7, 10) || 0),

      active_queues: parseInt(q.total, 10) || 0,
      queues_trend: this.calculateGrowth(parseInt(q.cur_30, 10) || 0, parseInt(q.prev_30, 10) || 0),
      queues_percentage: this.calculateGrowth(parseInt(q.cur_7, 10) || 0, parseInt(q.prev_7, 10) || 0),

      active_subscriptions: parseInt(s.total, 10) || 0,
      subscriptions_trend: this.calculateGrowth(parseInt(s.cur_30, 10) || 0, parseInt(s.prev_30, 10) || 0),
      subscriptions_percentage: this.calculateGrowth(parseInt(s.cur_7, 10) || 0, parseInt(s.prev_7, 10) || 0),

      total_revenue: parseFloat(r.total) || 0,
      revenue_trend: this.calculateGrowth(parseFloat(r.cur_30) || 0, parseFloat(r.prev_30) || 0),
      revenue_percentage: this.calculateGrowth(parseFloat(r.cur_7) || 0, parseFloat(r.prev_7) || 0),
    };
  }

  async getChartData(period: string = '7d') {
    let interval = '6 days';
    let dateFormat = 'DD';
    
    if (period === '30d') {
      interval = '29 days';
      dateFormat = 'DD Mon';
    } else if (period === '1y') {
      interval = '1 year';
      dateFormat = 'Mon YYYY';
    }

    const chartQuery = `
      SELECT TO_CHAR(created_at, '${dateFormat}') as name, COUNT(*) as value
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY TO_CHAR(created_at, '${dateFormat}'), DATE_TRUNC('${period === '1y' ? 'month' : 'day'}', created_at)
      ORDER BY DATE_TRUNC('${period === '1y' ? 'month' : 'day'}', created_at) ASC
    `;

    // Get 5 recent activities (latest audit logs)
    const recentQuery = `
      SELECT id, action, entity_type, created_at as date
      FROM audit_logs
      ORDER BY created_at DESC
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
      title: `${row.action} ${row.entity_type}`,
      date: new Date(row.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      value: row.entity_type,
      color: row.action === 'CREATE' ? 'badge-success' : row.action === 'UPDATE' ? 'badge-primary' : 'badge-danger',
    }));

    return {
      chart: chartData.length ? chartData : [{ name: '01', value: 0 }],
      recent: recentData,
    };
  }

  async getAllActivities(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT id, action, entity_type, entity_id, old_data, new_data, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countQuery = `
      SELECT COUNT(*) as total FROM audit_logs
    `;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(query, [limit, offset]),
      this.pool.query(countQuery),
    ]);

    const formattedData = dataRes.rows.map(row => ({
      id: row.id,
      title: `${row.action} ${row.entity_type}`,
      date: new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      type: row.entity_type,
      color: row.action === 'CREATE' ? 'badge-success' : row.action === 'UPDATE' ? 'badge-primary' : 'badge-danger',
      old_data: row.old_data,
      new_data: row.new_data
    }));

    return {
      data: formattedData,
      meta: {
        total: parseInt(countRes.rows[0].total, 10),
        page,
        limit,
      },
    };
  }

  async globalSearch(query: string) {
    if (!query || query.trim().length === 0) {
      return { users: [], businesses: [], services: [] };
    }

    const searchTerm = `%${query}%`;

    const userQuery = `
      SELECT id, full_name, email, role, is_active, created_at
      FROM users
      WHERE full_name ILIKE $1 OR email ILIKE $1
      LIMIT 10
    `;

    const businessQuery = `
      SELECT id, name, description as category, is_active, created_at
      FROM businesses
      WHERE name ILIKE $1 OR description ILIKE $1
      LIMIT 10
    `;

    const serviceQuery = `
      SELECT s.id, s.name, b.name as category, s.is_active, s.estimated_wait_time_mins as base_price, s.created_at
      FROM services s
      LEFT JOIN businesses b ON s.business_id = b.id
      WHERE s.name ILIKE $1 OR s.description ILIKE $1
      LIMIT 10
    `;

    const [usersRes, businessesRes, servicesRes] = await Promise.all([
      this.pool.query(userQuery, [searchTerm]),
      this.pool.query(businessQuery, [searchTerm]),
      this.pool.query(serviceQuery, [searchTerm]),
    ]);

    return {
      users: usersRes.rows,
      businesses: businessesRes.rows,
      services: servicesRes.rows,
    };
  }

  async getAllUsers(page: number = 1, limit: number = 20, period?: string, role?: string, status?: string, search?: string) {
    const offset = (page - 1) * limit;
    
    let whereClauses: string[] = [];
    let queryValues: any[] = [];
    let paramIdx = 1;

    if (period === 'today') {
      whereClauses.push(`created_at >= CURRENT_DATE`);
    } else if (period === 'weekly') {
      whereClauses.push(`created_at >= CURRENT_DATE - INTERVAL '7 days'`);
    } else if (period === 'monthly') {
      whereClauses.push(`created_at >= CURRENT_DATE - INTERVAL '30 days'`);
    }

    if (role && role !== 'ALL') {
      whereClauses.push(`role = $${paramIdx++}`);
      queryValues.push(role);
    }

    if (status && status !== 'ALL') {
      const isActive = status === 'ACTIVE';
      whereClauses.push(`is_active = $${paramIdx++}`);
      queryValues.push(isActive);
    }

    if (search && search.trim() !== '') {
      whereClauses.push(`(full_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR phone ILIKE $${paramIdx})`);
      queryValues.push(`%${search.trim()}%`);
      paramIdx++;
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    
    const dataValues = [...queryValues, limit, offset];
    const query = `
      SELECT id, email, full_name, role, phone AS phone_number, created_at, is_active
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(query, dataValues),
      this.pool.query(countQuery, queryValues),
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

  async getAllBusinesses(page: number = 1, limit: number = 20, status?: string, search?: string) {
    const offset = (page - 1) * limit;
    
    let whereClauses: string[] = [];
    let queryValues: any[] = [];
    let paramIdx = 1;

    if (status && status !== 'ALL') {
      if (status === 'VERIFIED') {
        whereClauses.push(`b.is_verified = true`);
        whereClauses.push(`b.is_active = true`);
      } else if (status === 'PENDING') {
        whereClauses.push(`b.is_verified = false`);
        whereClauses.push(`b.is_active = true`);
      } else if (status === 'SUSPENDED') {
        whereClauses.push(`b.is_active = false`);
      }
    }

    if (search && search.trim() !== '') {
      whereClauses.push(`(b.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR b.phone ILIKE $${paramIdx} OR u.full_name ILIKE $${paramIdx})`);
      queryValues.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*) FROM businesses b JOIN users u ON b.owner_id = u.id ${whereClause}`;

    const dataValues = [...queryValues, limit, offset];
    const query = `
      SELECT b.id, b.name, u.email, b.phone, b.is_verified, b.created_at, u.full_name as owner_name, b.is_active
      FROM businesses b
      JOIN users u ON b.owner_id = u.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(query, dataValues),
      this.pool.query(countQuery, queryValues),
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
    const newUser = res.rows[0];
    await this.logAudit('CREATE', 'USER', newUser.id, null, newUser);
    return newUser;
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
    const oldRes = await this.pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    const oldData = oldRes.rows[0];

    const res = await this.pool.query(query, values);
    if (res.rowCount === 0) throw new NotFoundException('User not found');
    
    const newData = res.rows[0];
    await this.logAudit('UPDATE', 'USER', userId, oldData, newData);
    
    return newData;
  }

  async deleteUser(userId: string) {
    const oldRes = await this.pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (oldRes.rowCount === 0) throw new NotFoundException('User not found');
    const oldData = oldRes.rows[0];

    const query = `UPDATE users SET is_active = false, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`;
    const res = await this.pool.query(query, [userId]);
    
    await this.logAudit('DELETE', 'USER', userId, oldData, null);
    
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
    const newBusiness = res.rows[0];
    await this.logAudit('CREATE', 'BUSINESS', newBusiness.id, null, newBusiness);
    return newBusiness;
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
    const oldRes = await this.pool.query(`SELECT * FROM businesses WHERE id = $1`, [businessId]);
    const oldData = oldRes.rows[0];

    const res = await this.pool.query(query, values);
    if (res.rowCount === 0) throw new NotFoundException('Business not found');
    
    const newData = res.rows[0];
    await this.logAudit('UPDATE', 'BUSINESS', businessId, oldData, newData);
    
    return newData;
  }

  async deleteBusiness(businessId: string) {
    const oldRes = await this.pool.query(`SELECT * FROM businesses WHERE id = $1`, [businessId]);
    if (oldRes.rowCount === 0) throw new NotFoundException('Business not found');
    const oldData = oldRes.rows[0];

    const query = `DELETE FROM businesses WHERE id = $1 RETURNING id`;
    const res = await this.pool.query(query, [businessId]);
    
    await this.logAudit('DELETE', 'BUSINESS', businessId, oldData, null);
    
    return true;
  }

  // --- Services CRUD ---
  async getAllServices(page: number = 1, limit: number = 20, status?: string, search?: string) {
    const offset = (page - 1) * limit;
    
    let whereClauses: string[] = [];
    let queryValues: any[] = [];
    let paramIdx = 1;

    if (status && status !== 'ALL') {
      const isActive = status === 'ACTIVE';
      whereClauses.push(`s.is_active = $${paramIdx++}`);
      queryValues.push(isActive);
    }

    if (search && search.trim() !== '') {
      whereClauses.push(`(s.name ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx})`);
      queryValues.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*) FROM services s JOIN businesses b ON s.business_id = b.id ${whereClause}`;

    const dataValues = [...queryValues, limit, offset];
    const query = `
      SELECT s.id, s.name, s.estimated_wait_time_mins, s.is_active, s.created_at, b.name as business_name, b.id as business_id
      FROM services s
      JOIN businesses b ON s.business_id = b.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query(query, dataValues),
      this.pool.query(countQuery, queryValues),
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
    const newService = res.rows[0];
    await this.logAudit('CREATE', 'SERVICE', newService.id, null, newService);
    return newService;
  }

  async updateServiceStatus(serviceId: string, isActive: boolean) {
    const query = `
      UPDATE services
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, is_active
    `;
    const oldRes = await this.pool.query(`SELECT * FROM services WHERE id = $1`, [serviceId]);
    const oldData = oldRes.rows[0];

    const res = await this.pool.query(query, [isActive, serviceId]);
    if (res.rowCount === 0) {
      throw new NotFoundException('Service not found');
    }
    const newData = res.rows[0];
    await this.logAudit('UPDATE', 'SERVICE', serviceId, oldData, newData);
    return newData;
  }

  async deleteService(serviceId: string) {
    const oldRes = await this.pool.query(`SELECT * FROM services WHERE id = $1`, [serviceId]);
    if (oldRes.rowCount === 0) throw new NotFoundException('Service not found');
    const oldData = oldRes.rows[0];

    // Assuming we want a hard delete here as well to match businesses? Wait, the user didn't ask for hard delete for services, only businesses. So I'll keep the soft delete but log it.
    const query = `UPDATE services SET is_active = false, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`;
    const res = await this.pool.query(query, [serviceId]);
    
    await this.logAudit('DELETE', 'SERVICE', serviceId, oldData, null);
    
    return true;
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

    if (data.is_active === true) {
      // Best practice: Ensure only one active plan per user.
      const subRes = await this.pool.query('SELECT user_id FROM subscriptions WHERE id = $1', [subscriptionId]);
      if (subRes.rowCount > 0) {
        const userId = subRes.rows[0].user_id;
        await this.pool.query(
          'UPDATE subscriptions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id != $2 AND is_active = true',
          [userId, subscriptionId]
        );
      }
    }

    values.push(subscriptionId);
    const query = `
      UPDATE subscriptions
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx}
      RETURNING id, plan_type, is_active, start_date, end_date
    `;
    const oldRes = await this.pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [subscriptionId]);
    const oldData = oldRes.rows[0];

    const res = await this.pool.query(query, values);
    if (res.rowCount === 0) throw new NotFoundException('Subscription not found');
    
    const newData = res.rows[0];
    await this.logAudit('UPDATE', 'SUBSCRIPTION', subscriptionId, oldData, newData);
    
    return newData;
  }

  async deleteSubscription(subscriptionId: string) {
    const oldRes = await this.pool.query(`SELECT * FROM subscriptions WHERE id = $1`, [subscriptionId]);
    if (oldRes.rowCount === 0) throw new NotFoundException('Subscription not found');
    const oldData = oldRes.rows[0];

    const query = `UPDATE subscriptions SET is_active = false, end_date = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`;
    const res = await this.pool.query(query, [subscriptionId]);
    
    await this.logAudit('DELETE', 'SUBSCRIPTION', subscriptionId, oldData, null);
    
    return true;
  }

  // --- Transactions (Payment Logs) ---
  async getAllTransactions(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT t.id, t.user_id, t.plan_type, t.amount, t.currency, t.order_id, t.payment_id, t.status, t.created_at, u.email, u.full_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const countQuery = `SELECT COUNT(*) FROM transactions`;

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
