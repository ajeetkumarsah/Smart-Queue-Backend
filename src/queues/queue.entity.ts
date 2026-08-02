export enum QueueStatus {
  CREATED = 'CREATED',
  WAITING = 'WAITING',
  READY = 'READY',
  ARRIVED = 'ARRIVED',
  CALLED = 'CALLED',
  SERVING = 'SERVING', // Equivalent to IN_SERVICE
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  NO_SHOW = 'NO_SHOW',
  TRANSFERRED = 'TRANSFERRED',
}

export interface QueueEntity {
  id: string;
  service_id: string;
  user_id: string;
  token_number: string;
  status: QueueStatus;
  position: number;
  priority?: number; // 0 for normal, 1 for VIP, etc.
  joined_at: Date;
  called_at?: Date;
  served_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
