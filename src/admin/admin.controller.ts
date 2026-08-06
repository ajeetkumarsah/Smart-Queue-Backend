import {
  Controller,
  Get,
  Post,
  Query,
  Patch,
  Delete,
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

  @Get('chart-data')
  async getChartData(@Query('period') period: string = '7d') {
    const data = await this.adminService.getChartData(period);
    return {
      status: true,
      message: 'Chart data fetched successfully',
      data,
    };
  }

  @Get('activities')
  async getActivities(@Query('page') page: string, @Query('limit') limit: string) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const data = await this.adminService.getAllActivities(pageNum, limitNum);
    return {
      status: true,
      message: 'Activities fetched successfully',
      data: data.data,
      meta: data.meta,
    };
  }

  @Get('search')
  async getSearch(@Query('q') q: string) {
    const data = await this.adminService.globalSearch(q);
    return {
      status: true,
      message: 'Search results fetched successfully',
      data,
    };
  }

  @Get('users')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('period') period?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.adminService.getAllUsers(
      parseInt(page, 10),
      parseInt(limit, 10),
      period,
      role,
      status,
      search
    );
    return {
      status: true,
      message: 'Users fetched successfully',
      data: data.data,
      meta: data.meta,
    };
  }

  @Post('users')
  async createUser(@Body() body: { full_name: string; email: string; phone: string; role?: string }) {
    const data = await this.adminService.createUser(body);
    return {
      status: true,
      message: 'User created successfully',
      data,
    };
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: { full_name?: string; phone?: string; role?: string; is_active?: boolean },
  ) {
    const data = await this.adminService.updateUser(id, body);
    return {
      status: true,
      message: 'User updated successfully',
      data,
    };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return {
      status: true,
      message: 'User deleted successfully',
    };
  }

  @Get('businesses')
  async getBusinesses(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.adminService.getAllBusinesses(
      parseInt(page, 10),
      parseInt(limit, 10),
      status,
      search
    );
    return {
      status: true,
      message: 'Businesses fetched successfully',
      data: data.data,
      meta: data.meta,
    };
  }

  @Post('businesses')
  async createBusiness(@Body() body: { owner_id: string; name: string; phone: string; category?: string; address?: string }) {
    const data = await this.adminService.createBusiness(body);
    return {
      status: true,
      message: 'Business created successfully',
      data,
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

  @Patch('businesses/:id')
  async updateBusiness(
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string; is_active?: boolean },
  ) {
    const data = await this.adminService.updateBusiness(id, body);
    return {
      status: true,
      message: 'Business updated successfully',
      data,
    };
  }

  @Delete('businesses/:id')
  async deleteBusiness(@Param('id') id: string) {
    await this.adminService.deleteBusiness(id);
    return {
      status: true,
      message: 'Business deleted successfully',
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

  @Patch('subscriptions/:id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() body: { plan_type?: string; is_active?: boolean; end_date?: string },
  ) {
    const data = await this.adminService.updateSubscription(id, body);
    return {
      status: true,
      message: 'Subscription updated successfully',
      data,
    };
  }

  @Delete('subscriptions/:id')
  async deleteSubscription(@Param('id') id: string) {
    await this.adminService.deleteSubscription(id);
    return {
      status: true,
      message: 'Subscription deleted successfully',
    };
  }

  @Get('services')
  async getServices(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.adminService.getAllServices(
      parseInt(page, 10),
      parseInt(limit, 10),
      status,
      search
    );
    return {
      status: true,
      message: 'Services fetched successfully',
      data: data.data,
      meta: data.meta,
    };
  }

  @Post('services')
  async createService(@Body() body: { business_id: string; name: string; estimated_wait_time_mins: number }) {
    const data = await this.adminService.createService(body);
    return {
      status: true,
      message: 'Service created successfully',
      data,
    };
  }

  @Patch('services/:id/status')
  async updateServiceStatus(
    @Param('id') id: string,
    @Body('is_active') isActive: boolean,
  ) {
    const data = await this.adminService.updateServiceStatus(id, isActive);
    return {
      status: true,
      message: 'Service status updated successfully',
      data,
    };
  }

  @Delete('services/:id')
  async deleteService(@Param('id') id: string) {
    await this.adminService.deleteService(id);
    return {
      status: true,
      message: 'Service deleted successfully',
    };
  }
}
