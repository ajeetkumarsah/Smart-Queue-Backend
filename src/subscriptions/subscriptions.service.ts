import { Injectable, BadRequestException } from '@nestjs/common';
import { SubscriptionsRepository } from './subscriptions.repository';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class SubscriptionsService {
  private razorpay: any;

  constructor(
    private readonly subscriptionsRepo: SubscriptionsRepository,
    private readonly configService: ConfigService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.configService.get<string>('RAZORPAY_KEY_SECRET'),
    });
  }

  async getActiveSubscription(userId: string) {
    const subscription = await this.subscriptionsRepo.findActiveByUserId(userId);
    if (!subscription) {
      // Default to BASIC plan if no active subscription exists
      const plan = await this.subscriptionsRepo.findPlanByCode('BASIC');
      return {
        id: 'default_basic',
        user_id: userId,
        plan_type: 'BASIC',
        status: 'ACTIVE',
        start_date: new Date(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
        max_businesses: plan ? plan.max_businesses : 1,
      };
    }
    const plan = await this.subscriptionsRepo.findPlanByCode(subscription.plan_type);
    return {
      ...subscription,
      max_businesses: plan ? plan.max_businesses : 1,
    };
  }

  async createOrder(userId: string, planType: string) {
    const plan = await this.subscriptionsRepo.findPlanByCode(planType);
    if (!plan) {
      throw new BadRequestException('Invalid plan type.');
    }

    const amountInPaise = Math.round(Number(plan.price) * 100);

    if (amountInPaise === 0) {
      // Free plan - bypass Razorpay
      await this.subscribe(userId, planType);
      
      // Log transaction as SUCCESS
      await this.subscriptionsRepo.createTransaction(
        userId,
        planType,
        0,
        'INR',
        `free_${userId}_${Date.now()}`,
      );

      return {
        is_free: true,
        order_id: `free_${userId}_${Date.now()}`,
        amount: 0,
        currency: 'INR',
      };
    }

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${userId}_${Date.now()}`,
    };

    try {
      const order = await this.razorpay.orders.create(options);
      
      // Log transaction as INITIATED
      await this.subscriptionsRepo.createTransaction(
        userId,
        planType,
        Number(plan.price),
        'INR',
        order.id,
      );

      return {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
      };
    } catch (err) {
      console.error('Razorpay Create Order Error:', err);
      throw new BadRequestException('Failed to create Razorpay order');
    }
  }

  async verifyPayment(
    userId: string,
    planType: string,
    paymentId: string,
    orderId: string,
    signature: string,
  ) {
    const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    if (generatedSignature !== signature) {
      // Log failure
      await this.subscriptionsRepo.updateTransactionStatus(
        orderId,
        'VERIFICATION_FAILED',
        paymentId,
      );
      throw new BadRequestException('Invalid payment signature');
    }

    // Log success
    await this.subscriptionsRepo.updateTransactionStatus(
      orderId,
      'SUCCESS',
      paymentId,
    );

    // Payment verified, activate subscription
    return this.subscribe(userId, planType);
  }

  async subscribe(userId: string, planType: string) {
    const plan = await this.subscriptionsRepo.findPlanByCode(planType);
    if (!plan) {
      throw new BadRequestException('Invalid plan type.');
    }

    // Deactivate any existing active subscriptions for this user
    await this.subscriptionsRepo.deactivateOldSubscriptions(userId);

    return this.subscriptionsRepo.create(userId, planType);
  }
}
