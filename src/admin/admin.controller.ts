import {
  Controller,
  Get,
  Query,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    const data = await this.adminService.getPlatformStats();
    return {
      status: true,
      message: 'Stats fetched successfully',
      data,
    };
  }

  @Get('users')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const data = await this.adminService.getAllUsers(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return {
      status: true,
      message: 'Users fetched successfully',
      data: data.data,
      meta: data.meta,
    };
  }

  @Get('businesses')
  async getBusinesses(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const data = await this.adminService.getAllBusinesses(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return {
      status: true,
      message: 'Businesses fetched successfully',
      data: data.data,
      meta: data.meta,
    };
  }

  @Get('subscriptions')
  async getSubscriptions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const data = await this.adminService.getAllSubscriptions(
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return {
      status: true,
      message: 'Subscriptions fetched successfully',
      data: data.data,
      meta: data.meta,
    };
  }

  @Patch('businesses/:id/verify')
  async verifyBusiness(
    @Param('id') id: string,
    @Body('is_verified') isVerified: boolean,
  ) {
    const data = await this.adminService.verifyBusiness(id, isVerified);
    return {
      status: true,
      message: 'Business verification status updated',
      data,
    };
  }
}
