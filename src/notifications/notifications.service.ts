import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepo: NotificationsRepository) {}

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
