import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { QueuesRepository } from './queues.repository';
import { QueueStatus } from './queue.entity';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QueuesService {
  constructor(
    private readonly queuesRepo: QueuesRepository,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  async joinQueue(userId: string, serviceId: string) {
    // For now, let the repo handle the join and we'll check the count inside it,
    // or we can add a method in repo to do it all safely.
    // Let's rely on the repo's joinQueue to throw if needed, or we implement the check here.
    
    const queue = await this.queuesRepo.joinQueue(userId, serviceId);

    this.eventsGateway.broadcastToService(serviceId, 'queueJoined', queue);
    this.eventsGateway.broadcastToUser(userId, 'queueUpdated', queue);

    this.notificationsService.sendPushNotification(
      userId,
      'Joined Queue',
      `You have successfully joined the queue. Your token is ${queue.token_number}.`,
      'QUEUE_UPDATE'
    );

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
    
    switch (newStatus) {
      case QueueStatus.READY:
        title = 'You are next!';
        body = `Please get ready. Token ${queue.token_number} will be called soon.`;
        break;
      case QueueStatus.CALLED:
        title = 'It is your turn!';
        body = `Token ${queue.token_number} is now being called.`;
        break;
      case QueueStatus.SERVING:
        title = 'Service Started';
        body = `You are now being served.`;
        break;
      case QueueStatus.COMPLETED:
        title = 'Service Completed';
        body = `Thank you for visiting! Please leave your feedback.`;
        break;
      case QueueStatus.CANCELLED:
        title = 'Queue Cancelled';
        body = `Your ticket ${queue.token_number} has been cancelled.`;
        break;
      case QueueStatus.NO_SHOW:
        title = 'Missed Turn';
        body = `You missed your turn for token ${queue.token_number}.`;
        break;
      case QueueStatus.SKIPPED:
        title = 'Turn Skipped';
        body = `Your turn was skipped. You may still be called shortly.`;
        break;
    }

    if (title) {
      this.notificationsService.sendPushNotification(
        queue.user_id,
        title,
        body,
        'QUEUE_UPDATE'
      );
    }

    this.eventsGateway.broadcastToService(queue.service_id, 'queueUpdated', queue);
    this.eventsGateway.broadcastToUser(queue.user_id, 'queueUpdated', queue);

    return queue;
  }
}
