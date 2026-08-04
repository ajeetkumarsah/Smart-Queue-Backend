import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepo: NotificationsRepository,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async testPushNotification(userId: string) {
    await this.notificationsQueue.add('send-notification', {
      userId,
      title: 'Test Notification',
      body: 'This is a test notification generated from the backend.',
      type: 'SYSTEM',
    });
    return { success: true, message: 'Test notification queued' };
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
