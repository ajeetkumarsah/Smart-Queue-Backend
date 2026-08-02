import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueuesRepository } from './queues.repository';
import { QueueStatus } from './queue.entity';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class QueuesService {
  constructor(
    private readonly queuesRepo: QueuesRepository,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  async joinQueue(userId: string, serviceId: string) {
    // Check if user is already in an active queue for this service
    const activeQueues = await this.queuesRepo.findActiveQueuesByUserId(userId);
    const alreadyInQueue = activeQueues.find(q => q.service_id === serviceId);
    if (alreadyInQueue) {
      throw new BadRequestException('You are already in the queue for this service.');
    }

    // Check service limits (assuming we query max queue size, we could do this via repo)
    // For now, let the repo handle the join and we'll check the count inside it,
    // or we can add a method in repo to do it all safely.
    // Let's rely on the repo's joinQueue to throw if needed, or we implement the check here.
    
    const queue = await this.queuesRepo.joinQueue(userId, serviceId);

    this.eventsGateway.broadcastToService(serviceId, 'queueJoined', queue);
    this.eventsGateway.broadcastToUser(userId, 'queueUpdated', queue);

    this.notificationsQueue.add('send-notification', {
      userId,
      title: 'Joined Queue',
      body: `You have successfully joined the queue. Your token is ${queue.token_number}.`,
    }).catch(err => console.error('Failed to add notification to queue:', err));

    return queue;
  }

  async getActiveQueues(userId: string) {
    return this.queuesRepo.findActiveQueuesByUserId(userId);
  }

  async getActiveQueuesByService(serviceId: string) {
    return this.queuesRepo.findActiveQueuesByService(serviceId);
  }

  async getQueueHistory(userId: string) {
    return this.queuesRepo.findQueueHistoryByUserId(userId);
  }

  async getServiceQueueHistory(serviceId: string) {
    return this.queuesRepo.findQueueHistoryByService(serviceId);
  }

  async leaveQueue(userId: string, queueId: string) {
    const queue = await this.queuesRepo.findById(queueId);
    if (!queue || queue.user_id !== userId) {
      throw new BadRequestException('Queue not found or unauthorized');
    }
    return this.updateStatus(queueId, QueueStatus.CANCELLED);
  }

  async updateStatus(queueId: string, newStatus: QueueStatus) {
    const queue = await this.queuesRepo.updateStatus(queueId, newStatus);

    let title = '';
    let body = '';
    if (newStatus === QueueStatus.CALLED) {
      title = 'It is your turn!';
      body = `Token ${queue.token_number} is now being called.`;
    } else if (newStatus === QueueStatus.COMPLETED) {
      title = 'Service Completed';
      body = `Thank you for visiting! Please leave your feedback.`;
    }

    if (title) {
      this.notificationsQueue.add('send-notification', {
        userId: queue.user_id,
        title,
        body,
      }).catch(err => console.error('Failed to add notification to queue:', err));
    }

    this.eventsGateway.broadcastToService(queue.service_id, 'queueUpdated', queue);
    this.eventsGateway.broadcastToUser(queue.user_id, 'queueUpdated', queue);

    return queue;
  }
}
