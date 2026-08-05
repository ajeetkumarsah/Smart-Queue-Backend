import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationsRepository } from './notifications.repository';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepo: NotificationsRepository,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async sendPushNotification(userId: string, title: string, body: string, type: string = 'SYSTEM') {
    try {
      const notification = await this.notificationsRepo.create({
        user_id: userId,
        title,
        body,
        type,
      });

      this.eventsGateway.broadcastToUser(userId, 'notification', notification);
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  async getUserNotifications(userId: string) {
    return this.notificationsRepo.findByUserId(userId);
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationsRepo.markAsRead(id, userId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  async markAllAsRead(userId: string) {
    await this.notificationsRepo.markAllAsRead(userId);
    return { success: true };
  }
}
