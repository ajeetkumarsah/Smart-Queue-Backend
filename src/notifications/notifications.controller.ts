import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  async getNotifications(@Request() req) {
    const data = await this.notificationsService.getUserNotifications(
      req.user.id,
    );
    return {
      status: true,
      message: 'Notifications fetched',
      messageType: 'none',
      data,
      error: null,
    };
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req) {
    const data = await this.notificationsService.markAllAsRead(
      req.user.id,
    );
    return {
      status: true,
      message: 'All notifications marked as read',
      messageType: 'none',
      data,
      error: null,
    };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    const data = await this.notificationsService.markAsRead(
      id,
      req.user.id,
    );
    return {
      status: true,
      message: 'Notification marked as read',
      messageType: 'none',
      data,
      error: null,
    };
  }
}
