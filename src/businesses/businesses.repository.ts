import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { BusinessEntity } from './business.entity';

@Injectable()
export class BusinessesRepository extends BaseRepository<BusinessEntity> {
  protected readonly tableName = 'businesses';

  async findByOwnerId(ownerId: string): Promise<BusinessEntity[]> {
    return this.query(
      `SELECT * FROM ${this.tableName} WHERE owner_id = $1 AND deleted_at IS NULL`,
      [ownerId],
    );
  }

  async search(term: string): Promise<BusinessEntity[]> {
    const searchPattern = `%${term}%`;
    return this.query(
      `
      SELECT * FROM ${this.tableName} 
      WHERE (name ILIKE $1 OR description ILIKE $1) 
      AND is_active = true 
      AND deleted_at IS NULL
    `,
      [searchPattern],
    );
  }

  async create(data: Partial<BusinessEntity>): Promise<BusinessEntity> {
    const text = `
      INSERT INTO ${this.tableName} (owner_id, name, description, address, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.queryOne(text, [
      data.owner_id,
      data.name,
      data.description,
      data.address,
      data.phone,
    ]);
    return result;
  }
}
