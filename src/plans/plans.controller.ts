import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PlanEntity } from './plans.entity';

import { Request } from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('plans')
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getActivePlans(@Request() req: any) {
    const plans = await this.plansService.getActivePlans();
    
    // Get the user's active subscription
    const activeSubscription = await this.subscriptionsService.getActiveSubscription(req.user.id);
    const activePlanCode = activeSubscription?.plan_type;

    // Attach is_current_active_plan flag, guaranteeing at most one is active
    let foundActive = false;
    const plansWithStatus = plans.map(plan => {
      let is_current = false;
      if (!foundActive && activePlanCode === plan.code) {
        is_current = true;
        foundActive = true;
      }
      return {
        ...plan,
        is_current_active_plan: is_current,
      };
    });

    return { status: true, data: plansWithStatus };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('all')
  async getAllPlans() {
    const plans = await this.plansService.getAllPlans();
    return { status: true, data: plans };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post()
  async createPlan(@Body() data: Partial<PlanEntity>) {
    const plan = await this.plansService.createPlan(data);
    return { data: plan, message: 'Plan created successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Patch(':id')
  async updatePlan(
    @Param('id') id: string,
    @Body() data: Partial<PlanEntity>,
  ) {
    const plan = await this.plansService.updatePlan(id, data);
    return { data: plan, message: 'Plan updated successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Delete(':id')
  async deletePlan(@Param('id') id: string) {
    await this.plansService.deletePlan(id);
    return { message: 'Plan deleted successfully' };
  }
}
