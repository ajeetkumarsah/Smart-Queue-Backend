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

  async search(term: string, category?: string): Promise<BusinessEntity[]> {
    const searchPattern = `%${term}%`;
    return this.query(
      `
      SELECT * FROM ${this.tableName} 
      WHERE (name ILIKE $1 OR description ILIKE $1) 
      AND is_active = true 
      AND deleted_at IS NULL
      AND ($2::VARCHAR IS NULL OR category = $2)
    `,
      [searchPattern, category || null],
    );
  }

  async findNearby(lat: number, lng: number, radiusKm = 50, category?: string): Promise<any[]> {
    const query = `
      SELECT b.*,
        ROUND((6371 * acos(least(1.0, greatest(-1.0, 
          cos(radians($1)) * cos(radians(b.latitude)) * 
          cos(radians(b.longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(b.latitude))
        ))))::numeric, 2)::double precision AS distance_km,
        COALESCE(
          (SELECT json_agg(s.*) FROM services s WHERE s.business_id = b.id AND s.is_active = true AND s.deleted_at IS NULL),
          '[]'::json
        ) as services
      FROM ${this.tableName} b
      WHERE b.is_active = true 
        AND b.deleted_at IS NULL 
        AND b.latitude IS NOT NULL 
        AND b.longitude IS NOT NULL
        AND ($4::VARCHAR IS NULL OR b.category = $4)
        AND (6371 * acos(least(1.0, greatest(-1.0, 
          cos(radians($1)) * cos(radians(b.latitude)) * 
          cos(radians(b.longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(b.latitude))
        )))) <= $3
      ORDER BY distance_km ASC
    `;
    const results = await this.query(query, [lat, lng, radiusKm, category || null]);
    if (results.length > 0) {
      return results;
    }
    const fallbackQuery = `
      SELECT b.*,
        ROUND((6371 * acos(least(1.0, greatest(-1.0, 
          cos(radians($1)) * cos(radians(b.latitude)) * 
          cos(radians(b.longitude) - radians($2)) + 
          sin(radians($1)) * sin(radians(b.latitude))
        ))))::numeric, 2)::double precision AS distance_km,
        COALESCE(
          (SELECT json_agg(s.*) FROM services s WHERE s.business_id = b.id AND s.is_active = true AND s.deleted_at IS NULL),
          '[]'::json
        ) as services
      FROM ${this.tableName} b
      WHERE b.is_active = true 
        AND b.deleted_at IS NULL 
        AND b.latitude IS NOT NULL 
        AND b.longitude IS NOT NULL
        AND ($3::VARCHAR IS NULL OR b.category = $3)
      ORDER BY distance_km ASC
      LIMIT 10
    `;
    return this.query(fallbackQuery, [lat, lng, category || null]);
  }

  async create(data: Partial<BusinessEntity>): Promise<BusinessEntity> {
    const text = `
      INSERT INTO ${this.tableName} (owner_id, name, category, description, address, phone, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await this.queryOne(text, [
      data.owner_id,
      data.name,
      data.category,
      data.description,
      data.address,
      data.phone,
      data.latitude,
      data.longitude,
    ]);
    return result;
  }
}
