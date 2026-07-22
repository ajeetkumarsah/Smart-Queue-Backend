import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueuesRepository } from './queues.repository';
import { QueueStatus } from './queue.entity';

@Injectable()
export class QueuesService {
  constructor(
    private readonly queuesRepo: QueuesRepository,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async joinQueue(userId: string, serviceId: string) {
    const queue = await this.queuesRepo.joinQueue(userId, serviceId);
    
    await this.notificationsQueue.add('send-notification', {
      userId,
      title: 'Joined Queue',
      body: \`You have successfully joined the queue. Your token is \${queue.token_number}.\`,
    });

    return queue;
  }

  async getActiveQueues(userId: string) {
    return this.queuesRepo.findActiveQueuesByUserId(userId);
  }

  async updateStatus(queueId: string, newStatus: QueueStatus) {
    const queue = await this.queuesRepo.updateStatus(queueId, newStatus);
    
    let title = '';
    let body = '';
    if (newStatus === QueueStatus.CALLED) {
      title = 'It is your turn!';
      body = \`Token \${queue.token_number} is now being called.\`;
    } else if (newStatus === QueueStatus.COMPLETED) {
      title = 'Service Completed';
      body = \`Thank you for visiting! Please leave your feedback.\`;
    }

    if (title) {
      await this.notificationsQueue.add('send-notification', {
        userId: queue.user_id,
        title,
        body,
      });
    }

    return queue;
  }
}

