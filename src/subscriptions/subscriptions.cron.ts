import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsRepository } from './subscriptions.repository';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SubscriptionsCron {
  private readonly logger = new Logger(SubscriptionsCron.name);

  constructor(
    private readonly subscriptionsRepo: SubscriptionsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleSubscriptionExpirations() {
    this.logger.log('Running daily subscription expiration check...');
    
    // 1. Send warning for subscriptions expiring in 3 days
    const expiringSoon = await this.subscriptionsRepo.findExpiringIn(3);
    for (const sub of expiringSoon) {
      await this.notificationsService.sendPushNotification(
        sub.user_id, 
        'Plan Expiring Soon', 
        'Your subscription will expire in 3 days. Renew now to avoid losing access to premium features.',
        'SUBSCRIPTION'
      );
      this.logger.log(`Warning user ${sub.user_id} about expiration`);
    }

    // 2. Expire plans and fallback to BASIC
    const expired = await this.subscriptionsRepo.findExpired();
    for (const sub of expired) {
      // Mark old as inactive
      await this.subscriptionsRepo.deactivateOldSubscriptions(sub.user_id);
      
      // Fallback to BASIC
      await this.subscriptionsRepo.create(sub.user_id, 'BASIC');
      
      await this.notificationsService.sendPushNotification(
        sub.user_id, 
        'Plan Expired', 
        'Your subscription has expired. You have been downgraded to the Basic plan. Editing is restricted.',
        'SUBSCRIPTION'
      );
      this.logger.log(`Downgraded user ${sub.user_id} to BASIC plan`);
    }

    this.logger.log('Daily subscription expiration check completed.');
  }
}
