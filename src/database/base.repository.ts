import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { PG_CONNECTION } from './database.constants';

@Injectable()
export abstract class BaseRepository<T extends QueryResultRow> {
  protected abstract readonly tableName: string;

  constructor(@Inject(PG_CONNECTION) protected readonly pool: Pool) {}

  /**
   * Executes a raw SQL query safely with parameters
   */
  protected async query<R extends QueryResultRow = T>(
    text: string,
    params?: any[],
  ): Promise<R[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<R>(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Executes a raw SQL query safely and returns the first row
   */
  protected async queryOne<R extends QueryResultRow = T>(
    text: string,
    params?: any[],
  ): Promise<R | null> {
    const rows = await this.query<R>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find by ID (excluding soft deleted)
   */
  async findById(id: string): Promise<T | null> {
    const text = `SELECT * FROM ${this.tableName} WHERE id = $1 AND deleted_at IS NULL`;
    return this.queryOne(text, [id]);
  }

  /**
   * Find all (excluding soft deleted)
   */
  async findAll(): Promise<T[]> {
    const text = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL`;
    return this.query(text);
  }

  /**
   * Soft delete by ID
   */
  async softDelete(id: string): Promise<boolean> {
    const text = `UPDATE ${this.tableName} SET deleted_at = NOW() WHERE id = $1 RETURNING id`;
    const result = await this.query(text, [id]);
    return result.length > 0;
  }

  /**
   * Hard delete by ID
   */
  async hardDelete(id: string): Promise<boolean> {
    const text = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`;
    const result = await this.query(text, [id]);
    return result.length > 0;
  }
}
