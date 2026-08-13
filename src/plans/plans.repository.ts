import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { BaseRepository } from '../database/base.repository';
import { PG_CONNECTION } from '../database/database.constants';
import { PlanEntity } from './plans.entity';

@Injectable()
export class PlansRepository extends BaseRepository<PlanEntity> {
  protected readonly tableName = 'plans';

  constructor(@Inject(PG_CONNECTION) pool: Pool) {
    super(pool);
  }

  async findAll(): Promise<PlanEntity[]> {
    return this.query<PlanEntity>(`SELECT * FROM ${this.tableName} ORDER BY created_at DESC`);
  }

  async findById(id: string): Promise<PlanEntity | null> {
    return this.queryOne<PlanEntity>(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id]);
  }

  async findActivePlans(): Promise<PlanEntity[]> {
    return this.query<PlanEntity>(
      `SELECT * FROM ${this.tableName} WHERE is_active = true ORDER BY price ASC`
    );
  }

  async createPlan(data: Partial<PlanEntity>): Promise<PlanEntity> {
    const text = `
      INSERT INTO ${this.tableName} (name, code, price, period, features, is_active, has_tag, tag_text, description, original_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    return this.queryOne(text, [
      data.name,
      data.code,
      data.price,
      data.period,
      JSON.stringify(data.features || []),
      data.is_active ?? true,
      data.has_tag ?? false,
      data.tag_text ?? null,
      data.description ?? null,
      data.original_price ?? null,
    ]);
  }

  async updatePlan(id: string, data: Partial<PlanEntity>): Promise<PlanEntity> {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.code !== undefined) {
      updates.push(`code = $${idx++}`);
      values.push(data.code);
    }
    if (data.price !== undefined) {
      updates.push(`price = $${idx++}`);
      values.push(data.price);
    }
    if (data.period !== undefined) {
      updates.push(`period = $${idx++}`);
      values.push(data.period);
    }
    if (data.features !== undefined) {
      updates.push(`features = $${idx++}`);
      values.push(JSON.stringify(data.features));
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(data.is_active);
    }
    if (data.has_tag !== undefined) {
      updates.push(`has_tag = $${idx++}`);
      values.push(data.has_tag);
    }
    if (data.tag_text !== undefined) {
      updates.push(`tag_text = $${idx++}`);
      values.push(data.tag_text);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.original_price !== undefined) {
      updates.push(`original_price = $${idx++}`);
      values.push(data.original_price);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const text = `
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;
    return this.queryOne(text, values);
  }

  async deletePlan(id: string): Promise<void> {
    await this.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
  }
}
