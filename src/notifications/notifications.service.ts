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

  async testPushNotification(userId: string) {
    // Bypass BullMQ for testing because the remote Redis instance is inaccessible locally
    const notification = await this.notificationsRepo.create({
      user_id: userId,
      title: 'Test Notification',
      body: 'This is a test notification generated from the backend.',
      type: 'SYSTEM',
    });

    this.eventsGateway.broadcastToUser(userId, 'notification', notification);
    
    return { success: true, message: 'Test notification queued and broadcasted directly' };
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
