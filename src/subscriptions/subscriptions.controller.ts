import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Roles('BUSINESS_OWNER')
  @Get('my')
  async getMySubscription(@Request() req: any) {
    const sub = await this.subscriptionsService.getActiveSubscription(
      req.user.id,
    );
    return {
      status: true,
      message: 'Subscription fetched',
      messageType: 'none',
      data: sub,
      error: null,
    };
  }

  @Roles('BUSINESS_OWNER')
  @Post('create-order')
  async createOrder(
    @Request() req: any,
    @Body('plan_type') planType: string,
  ) {
    const data = await this.subscriptionsService.createOrder(
      req.user.id,
      planType,
    );
    return {
      status: true,
      message: 'Order created successfully',
      messageType: 'none',
      data,
      error: null,
    };
  }

  @Roles('BUSINESS_OWNER')
  @Post('verify-payment')
  async verifyPayment(
    @Request() req: any,
    @Body('plan_type') planType: string,
    @Body('razorpay_payment_id') paymentId: string,
    @Body('razorpay_order_id') orderId: string,
    @Body('razorpay_signature') signature: string,
  ) {
    const sub = await this.subscriptionsService.verifyPayment(
      req.user.id,
      planType,
      paymentId,
      orderId,
      signature,
    );
    return {
      status: true,
      message: 'Subscription activated successfully',
      messageType: 'toast',
      data: sub,
      error: null,
    };
  }

  // Fallback direct subscribe for testing or legacy clients
  @Roles('BUSINESS_OWNER')
  @Post('subscribe')
  async subscribe(
    @Request() req: any,
    @Body('plan_type') planType: string,
  ) {
    const sub = await this.subscriptionsService.subscribe(
      req.user.id,
      planType,
    );
    return {
      status: true,
      message: 'Subscription activated successfully',
      messageType: 'toast',
      data: sub,
      error: null,
    };
  }
}
