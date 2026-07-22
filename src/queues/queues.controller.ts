import { Controller, Post, Get, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { QueueStatus } from './queue.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Roles('CUSTOMER')
  @Get('my/active')
  async getActiveQueues(@Request() req: any) {
    const data = await this.queuesService.getActiveQueues(req.user.id);
    return { status: true, message: 'Fetched active queues', data, error: null };
  }

  @Roles('CUSTOMER')
  @Post('join')
  async joinQueue(@Request() req: any, @Body('service_id') serviceId: string) {
    const data = await this.queuesService.joinQueue(req.user.id, serviceId);
    return { status: true, message: 'Joined queue successfully', data, error: null };
  }

  @Roles('BUSINESS_OWNER', 'SUPER_ADMIN')
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: QueueStatus) {
    const data = await this.queuesService.updateStatus(id, status);
    return { status: true, message: 'Status updated successfully', data, error: null };
  }
}

