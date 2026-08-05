import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { ServiceEntity } from './service.entity';

@Injectable()
export class ServicesRepository extends BaseRepository<ServiceEntity> {
  protected readonly tableName = 'services';

  async findByBusinessId(businessId: string): Promise<ServiceEntity[]> {
    return this.query(
      `SELECT * FROM ${this.tableName} WHERE business_id = $1 AND deleted_at IS NULL`,
      [businessId],
    );
  }

  async create(data: Partial<ServiceEntity>): Promise<ServiceEntity> {
    const text = `
      INSERT INTO ${this.tableName} (business_id, name, description, estimated_wait_time_mins, max_queue_size)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.queryOne(text, [
      data.business_id,
      data.name,
      data.description,
      data.estimated_wait_time_mins,
      data.max_queue_size,
    ]);
    return result;
  }
  async updateStatus(id: string, isActive: boolean): Promise<ServiceEntity> {
    const text = `
      UPDATE ${this.tableName}
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `;
    return this.queryOne(text, [isActive, id]);
  }

  async findById(id: string): Promise<ServiceEntity> {
    const text = `SELECT * FROM ${this.tableName} WHERE id = $1 AND deleted_at IS NULL`;
    return this.queryOne(text, [id]);
  }
}
