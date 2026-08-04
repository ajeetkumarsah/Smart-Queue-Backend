import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationsRepository } from '../notifications/notifications.repository';

@Processor('notifications')
export class QueueProcessor extends WorkerHost {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(private readonly notificationsRepo: NotificationsRepository) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    if (job.name === 'send-notification') {
      const { userId, title, body, type } = job.data;
      
      // Save to database
      await this.notificationsRepo.create({
        user_id: userId,
        title,
        body,
        type: type || 'QUEUE_UPDATE'
      });

      // Here we would integrate with Firebase Admin SDK to send FCM
      this.logger.log(
        `Sending notification to user ${userId}: ${title} - ${body}`,
      );
    }

    return {};
  }
}
