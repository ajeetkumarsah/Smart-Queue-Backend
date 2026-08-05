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
    const sub = await this.subscriptionsService.getActiveSubscription(req.user.id);
    return { data: sub };
  }

  @Roles('BUSINESS_OWNER')
  @Post('subscribe')
  async subscribe(
    @Request() req: any,
    @Body('plan_type') planType: string,
  ) {
    const sub = await this.subscriptionsService.subscribe(req.user.id, planType);
    return {
      message: 'Subscription successful',
      data: sub,
    };
  }
}
