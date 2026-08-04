import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { QueueEntity, QueueStatus } from './queue.entity';

@Injectable()
export class QueuesRepository extends BaseRepository<QueueEntity> {
  protected readonly tableName = 'queues';

  async joinQueue(userId: string, serviceId: string): Promise<QueueEntity> {
    // Basic logic for token and position
    // In production, this should run in a transaction with locks
    
    // First, check max_queue_size and is_active
    const serviceRes = await this.query<{ max_queue_size: number; is_active: boolean }>(
      'SELECT max_queue_size, is_active FROM services WHERE id = $1',
      [serviceId],
    );
    if (!serviceRes || serviceRes.length === 0) {
      throw new BadRequestException('Service not found');
    }
    const service = serviceRes[0];
    if (!service.is_active) {
      throw new BadRequestException('This service is currently closed');
    }

    const countResult = await this.query<{ count: string }>(
      'SELECT COUNT(*) FROM queues WHERE service_id = $1 AND status IN ($2, $3, $4, $5, $6)',
      [serviceId, QueueStatus.CREATED, QueueStatus.WAITING, QueueStatus.READY, QueueStatus.ARRIVED, QueueStatus.CALLED],
    );
    const position = parseInt(countResult[0]?.count || '0', 10) + 1;
    
    if (service.max_queue_size && service.max_queue_size > 0 && position > service.max_queue_size) {
      throw new BadRequestException('Maximum queue size reached');
    }
    const token = `T-${position.toString().padStart(4, '0')}`;

    const text = `
      INSERT INTO ${this.tableName} (user_id, service_id, token_number, position, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await this.queryOne(text, [
      userId,
      serviceId,
      token,
      position,
      QueueStatus.WAITING,
    ]);
    return this.findByIdWithDetails(result.id);
  }

  async findByIdWithDetails(queueId: string): Promise<any> {
    const text = `
      SELECT q.*, s.name as service_name, b.name as business_name, b.logo_url as business_image_url, 
        (
          SELECT COUNT(*) FROM ${this.tableName} q2 
          WHERE q2.service_id = q.service_id 
            AND q2.position < q.position 
            AND q2.status IN ($2, $3, $4, $5, $6, $7)
        ) * s.estimated_wait_time_mins as estimated_wait_time_mins,
        u.full_name as user_name, u.email as user_email
      FROM ${this.tableName} q
      JOIN services s ON q.service_id = s.id
      JOIN businesses b ON s.business_id = b.id
      JOIN users u ON q.user_id = u.id
      WHERE q.id = $1
    `;
    return this.queryOne(text, [
      queueId,
      QueueStatus.CREATED,
      QueueStatus.WAITING,
      QueueStatus.READY,
      QueueStatus.ARRIVED,
      QueueStatus.CALLED,
      QueueStatus.SERVING,
    ]);
  }

  async findActiveQueuesByUserId(userId: string): Promise<any[]> {
    const text = `
      SELECT q.*, s.name as service_name, b.name as business_name, b.logo_url as business_image_url, 
        (
          SELECT COUNT(*) FROM ${this.tableName} q2 
          WHERE q2.service_id = q.service_id 
            AND q2.position < q.position 
            AND q2.status IN ($2, $3, $4, $5, $6, $7)
        ) * s.estimated_wait_time_mins as estimated_wait_time_mins
      FROM ${this.tableName} q
      JOIN services s ON q.service_id = s.id
      JOIN businesses b ON s.business_id = b.id
      WHERE q.user_id = $1 AND q.status IN ($2, $3, $4, $5, $6, $7)
      ORDER BY q.created_at DESC
    `;
    const results = await this.query(text, [
      userId,
      QueueStatus.CREATED,
      QueueStatus.WAITING,
      QueueStatus.READY,
      QueueStatus.ARRIVED,
      QueueStatus.CALLED,
      QueueStatus.SERVING,
    ]);
    return results;
  }

  async findActiveQueuesByService(serviceId: string): Promise<any[]> {
    const text = `
      SELECT q.*, u.full_name as user_name, u.email as user_email,
        (
          SELECT COUNT(*) FROM ${this.tableName} q2 
          WHERE q2.service_id = q.service_id 
            AND q2.position < q.position 
            AND q2.status IN ($2, $3, $4, $5, $6, $7)
        ) * s.estimated_wait_time_mins as estimated_wait_time_mins
      FROM ${this.tableName} q
      JOIN users u ON q.user_id = u.id
      JOIN services s ON q.service_id = s.id
      WHERE q.service_id = $1 AND q.status IN ($2, $3, $4, $5, $6, $7)
      ORDER BY q.priority DESC, q.position ASC
    `;
    const results = await this.query(text, [
      serviceId,
      QueueStatus.CREATED,
      QueueStatus.WAITING,
      QueueStatus.READY,
      QueueStatus.ARRIVED,
      QueueStatus.CALLED,
      QueueStatus.SERVING,
    ]);
    return results;
  }

  async updateStatus(
    queueId: string,
    newStatus: QueueStatus,
  ): Promise<QueueEntity> {
    const current = await this.findById(queueId);
    if (!current) throw new BadRequestException('Queue not found');

    if (!this.isValidTransition(current.status, newStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${current.status} to ${newStatus}`,
      );
    }

    let timestampField = '';
    if (newStatus === QueueStatus.CALLED)
      timestampField = ', called_at = NOW()';
    else if (newStatus === QueueStatus.SERVING)
      timestampField = ', served_at = NOW()';
    else if (newStatus === QueueStatus.COMPLETED)
      timestampField = ', completed_at = NOW()';

    const text = `UPDATE ${this.tableName} SET status = $1 ${timestampField} WHERE id = $2 RETURNING *`;
    const result = await this.queryOne(text, [newStatus, queueId]);
    return this.findByIdWithDetails(result.id);
  }

  async findQueueHistoryByUserId(userId: string): Promise<any[]> {
    const text = `
      SELECT q.*, s.name as service_name, b.name as business_name, b.logo_url as business_image_url, s.estimated_wait_time_mins
      FROM ${this.tableName} q
      JOIN services s ON q.service_id = s.id
      JOIN businesses b ON s.business_id = b.id
      WHERE q.user_id = $1 AND q.status IN ($2, $3, $4, $5)
      ORDER BY q.created_at DESC
    `;
    const results = await this.query(text, [
      userId,
      QueueStatus.COMPLETED,
      QueueStatus.CANCELLED,
      QueueStatus.SKIPPED,
      QueueStatus.NO_SHOW,
    ]);
    return results;
  }

  async findQueueHistoryByService(serviceId: string): Promise<any[]> {
    const text = `
      SELECT q.*, u.full_name as user_name, u.email as user_email
      FROM ${this.tableName} q
      JOIN users u ON q.user_id = u.id
      WHERE q.service_id = $1 AND q.status IN ($2, $3, $4, $5)
      ORDER BY q.created_at DESC
    `;
    const results = await this.query(text, [
      serviceId,
      QueueStatus.COMPLETED,
      QueueStatus.CANCELLED,
      QueueStatus.SKIPPED,
      QueueStatus.NO_SHOW,
    ]);
    return results;
  }

  private isValidTransition(current: QueueStatus, next: QueueStatus): boolean {
    const transitions: Record<QueueStatus, QueueStatus[]> = {
      [QueueStatus.CREATED]: [QueueStatus.WAITING, QueueStatus.CANCELLED],
      [QueueStatus.WAITING]: [
        QueueStatus.READY,
        QueueStatus.CALLED,
        QueueStatus.ARRIVED,
        QueueStatus.CANCELLED,
        QueueStatus.NO_SHOW,
        QueueStatus.EXPIRED,
        QueueStatus.TRANSFERRED,
      ],
      [QueueStatus.READY]: [
        QueueStatus.ARRIVED,
        QueueStatus.CALLED,
        QueueStatus.CANCELLED,
      ],
      [QueueStatus.ARRIVED]: [QueueStatus.CALLED, QueueStatus.SERVING],
      [QueueStatus.CALLED]: [
        QueueStatus.SERVING,
        QueueStatus.SKIPPED,
        QueueStatus.NO_SHOW,
        QueueStatus.ARRIVED, // E.g., operator calls them, then they arrive
      ],
      [QueueStatus.SERVING]: [QueueStatus.COMPLETED, QueueStatus.TRANSFERRED],
      [QueueStatus.COMPLETED]: [],
      [QueueStatus.SKIPPED]: [QueueStatus.CALLED], // Can be recalled
      [QueueStatus.CANCELLED]: [],
      [QueueStatus.EXPIRED]: [],
      [QueueStatus.NO_SHOW]: [QueueStatus.WAITING], // Allow rejoin logic
      [QueueStatus.TRANSFERRED]: [],
    };
    return transitions[current]?.includes(next) || false;
  }
}
