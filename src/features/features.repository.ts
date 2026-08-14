import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { FeatureEntity } from './features.entity';
import { PG_CONNECTION } from '../database/database.constants';

@Injectable()
export class FeaturesRepository {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findAll(): Promise<FeatureEntity[]> {
    const res = await this.pool.query('SELECT * FROM features ORDER BY display_order ASC, created_at ASC');
    return res.rows;
  }

  async create(data: Partial<FeatureEntity>): Promise<FeatureEntity> {
    const text = `
      INSERT INTO features (name)
      VALUES ($1)
      RETURNING *
    `;
    const values = [data.name];
    const res = await this.pool.query(text, values);
    return res.rows[0];
  }

  async update(id: string, data: Partial<FeatureEntity>): Promise<FeatureEntity> {
    const text = `
      UPDATE features
      SET name = COALESCE($1, name),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const values = [data.name, id];
    const res = await this.pool.query(text, values);
    return res.rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM features WHERE id = $1', [id]);
  }

  async reorder(items: { id: string; display_order: number }[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query('UPDATE features SET display_order = $1 WHERE id = $2', [item.display_order, item.id]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
