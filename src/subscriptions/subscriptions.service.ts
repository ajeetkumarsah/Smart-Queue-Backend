import { Injectable, BadRequestException } from '@nestjs/common';
import { SubscriptionsRepository } from './subscriptions.repository';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly subscriptionsRepo: SubscriptionsRepository) {}

  async getActiveSubscription(userId: string) {
    return this.subscriptionsRepo.findActiveByUserId(userId);
  }

  async subscribe(userId: string, planType: string) {
    if (!['MONTHLY', 'YEARLY'].includes(planType)) {
      throw new BadRequestException('Invalid plan type. Must be MONTHLY or YEARLY');
    }

    // Check if already active
    const active = await this.getActiveSubscription(userId);
    if (active) {
      throw new BadRequestException('You already have an active subscription');
    }

    // Process mock payment here if needed

    return this.subscriptionsRepo.create(userId, planType);
  }
}
