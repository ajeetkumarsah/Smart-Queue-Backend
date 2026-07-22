import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { QueueEntity, QueueStatus } from './queue.entity';

@Injectable()
export class QueuesRepository extends BaseRepository<QueueEntity> {
  protected readonly tableName = 'queues';

  async joinQueue(userId: string, serviceId: string): Promise<QueueEntity> {
    // Basic logic for token and position
    // In production, this should run in a transaction with locks
    const countResult = await this.query<{count: string}>('SELECT COUNT(*) FROM queues WHERE service_id = $1 AND status IN ($2, $3, $4)', [serviceId, QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.SERVING]);
    const position = parseInt(countResult[0]?.count || '0', 10) + 1;
    const token = \`T-\${position.toString().padStart(4, '0')}\`;

    const text = \`
      INSERT INTO \${this.tableName} (user_id, service_id, token_number, position, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    \`;
    const result = await this.queryOne(text, [userId, serviceId, token, position, QueueStatus.WAITING]);
    return result as QueueEntity;
  }

  async findActiveQueuesByUserId(userId: string): Promise<any[]> {
    const text = `
      SELECT q.*, s.name as service_name, b.name as business_name, s.estimated_wait_time_mins
      FROM ${this.tableName} q
      JOIN services s ON q.service_id = s.id
      JOIN businesses b ON s.business_id = b.id
      WHERE q.user_id = $1 AND q.status IN ($2, $3, $4)
      ORDER BY q.created_at DESC
    `;
    const results = await this.query(text, [userId, QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.SERVING]);
    return results;
  }

  async updateStatus(queueId: string, newStatus: QueueStatus): Promise<QueueEntity> {
    const current = await this.findById(queueId);
    if (!current) throw new BadRequestException('Queue not found');

    if (!this.isValidTransition(current.status, newStatus)) {
      throw new BadRequestException(\`Invalid transition from \${current.status} to \${newStatus}\`);
    }

    let timestampField = '';
    if (newStatus === QueueStatus.CALLED) timestampField = ', called_at = NOW()';
    else if (newStatus === QueueStatus.SERVING) timestampField = ', served_at = NOW()';
    else if (newStatus === QueueStatus.COMPLETED) timestampField = ', completed_at = NOW()';

    const text = \`UPDATE \${this.tableName} SET status = $1 \${timestampField} WHERE id = $2 RETURNING *\`;
    const result = await this.queryOne(text, [newStatus, queueId]);
    return result as QueueEntity;
  }

  private isValidTransition(current: QueueStatus, next: QueueStatus): boolean {
    const transitions: Record<QueueStatus, QueueStatus[]> = {
      [QueueStatus.WAITING]: [QueueStatus.CALLED, QueueStatus.CANCELLED],
      [QueueStatus.CALLED]: [QueueStatus.SERVING, QueueStatus.SKIPPED, QueueStatus.NO_SHOW],
      [QueueStatus.SERVING]: [QueueStatus.COMPLETED],
      [QueueStatus.COMPLETED]: [],
      [QueueStatus.SKIPPED]: [QueueStatus.CALLED], // Can be recalled
      [QueueStatus.CANCELLED]: [],
      [QueueStatus.EXPIRED]: [],
      [QueueStatus.NO_SHOW]: [],
    };
    return transitions[current]?.includes(next) || false;
  }
}
