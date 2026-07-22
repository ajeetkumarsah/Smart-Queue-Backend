export enum QueueStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  SERVING = 'SERVING',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  NO_SHOW = 'NO_SHOW',
}

export interface QueueEntity {
  id: string;
  service_id: string;
  user_id: string;
  token_number: string;
  status: QueueStatus;
  position: number;
  joined_at: Date;
  called_at?: Date;
  served_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
