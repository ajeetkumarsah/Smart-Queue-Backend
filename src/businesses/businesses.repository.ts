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

  async search(term: string, category?: string): Promise<any[]> {
    const searchPattern = `%${term}%`;
    return this.query(
      `
      SELECT b.*,
        u.full_name AS owner_name,
        COALESCE(
          (SELECT ROUND(AVG(f.rating)::numeric, 1)
           FROM feedback f WHERE f.business_id = b.id), 0
        ) AS avg_rating,
        COALESCE(
          (SELECT COUNT(*) FROM feedback f WHERE f.business_id = b.id), 0
        ) AS review_count
      FROM ${this.tableName} b
      LEFT JOIN users u ON u.id = b.owner_id
      WHERE (b.name ILIKE $1 OR b.description ILIKE $1) 
      AND b.is_active = true 
      AND b.deleted_at IS NULL
      AND ($2::VARCHAR IS NULL OR b.category = $2)
    `,
      [searchPattern, category || null],
    );
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm = 50,
    category?: string,
  ): Promise<any[]> {
    const baseSelect = `
      SELECT b.*,
        u.full_name AS owner_name,
        ROUND((6371 * acos(least(1.0, greatest(-1.0,
          cos(radians($1)) * cos(radians(b.latitude)) *
          cos(radians(b.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(b.latitude))
        ))))::numeric, 2)::double precision AS distance_km,
        COALESCE(
          (SELECT json_agg(s.*)
           FROM services s
           WHERE s.business_id = b.id
             AND s.is_active = true
             AND s.deleted_at IS NULL),
          '[]'::json
        ) AS services,
        COALESCE(
          (SELECT ROUND(AVG(f.rating)::numeric, 1)
           FROM feedback f WHERE f.business_id = b.id), 0
        ) AS avg_rating,
        COALESCE(
          (SELECT COUNT(*)
           FROM feedback f WHERE f.business_id = b.id), 0
        ) AS review_count
      FROM ${this.tableName} b
      LEFT JOIN users u ON u.id = b.owner_id
      WHERE b.is_active = true
        AND b.deleted_at IS NULL
        AND b.latitude IS NOT NULL
        AND b.longitude IS NOT NULL
    `;
    const withinRadius = await this.query(
      `${baseSelect}
        AND ($4::VARCHAR IS NULL OR b.category = $4)
        AND (6371 * acos(least(1.0, greatest(-1.0,
          cos(radians($1)) * cos(radians(b.latitude)) *
          cos(radians(b.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(b.latitude))
        )))) <= $3
      ORDER BY distance_km ASC`,
      [lat, lng, radiusKm, category || null],
    );
    if (withinRadius.length > 0) return withinRadius;
    return this.query(
      `${baseSelect}
        AND ($3::VARCHAR IS NULL OR b.category = $3)
      ORDER BY distance_km ASC
      LIMIT 10`,
      [lat, lng, category || null],
    );
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

  async update(id: string, data: Partial<BusinessEntity>): Promise<BusinessEntity | null> {
    const keys = Object.keys(data).filter(key => data[key] !== undefined);
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = keys.map((key) => data[key]);

    const text = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    return this.queryOne(text, [id, ...values]);
  }
}
