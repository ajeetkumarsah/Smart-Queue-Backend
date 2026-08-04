import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class NotificationsRepository extends BaseRepository<NotificationEntity> {
  protected readonly tableName = 'notifications';

  async findByUserId(userId: string): Promise<NotificationEntity[]> {
    const text = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return this.query(text, [userId]);
  }

  async create(data: {
    user_id: string;
    title: string;
    body: string;
    type?: string;
  }): Promise<NotificationEntity> {
    const text = `
      INSERT INTO ${this.tableName} (user_id, title, body, type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.query(text, [
      data.user_id,
      data.title,
      data.body,
      data.type || 'SYSTEM',
    ]);
    return result[0];
  }

  async markAsRead(id: string, userId: string): Promise<NotificationEntity> {
    const text = `
      UPDATE ${this.tableName}
      SET is_read = true, updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;
    const result = await this.query(text, [id, userId]);
    return result[0];
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const text = `
      UPDATE ${this.tableName}
      SET is_read = true, updated_at = NOW()
      WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL
      RETURNING id
    `;
    const result = await this.query(text, [userId]);
    return result.length > 0;
  }
}
