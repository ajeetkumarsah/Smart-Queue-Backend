import { Controller, Post, Body, UseGuards, Request, Get, Headers } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER')
  @Post('create-order')
  async createOrder(
    @Request() req: any,
    @Body('plan_type') planType: string,
    @Body('plan_id') planId: string,
  ) {
    const data = await this.subscriptionsService.createOrder(
      req.user.id,
      planType,
      planId,
    );
    return {
      status: true,
      message: 'Order created successfully',
      messageType: 'none',
      data,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post('webhook')
  async handleWebhook(
    @Request() req: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    // req.rawBody is populated because rawBody: true is enabled in NestFactory
    if (!req.rawBody) {
      return { status: 'ignored', reason: 'rawBody missing' };
    }
    return this.subscriptionsService.handleWebhook(req.rawBody, signature);
  }
}
