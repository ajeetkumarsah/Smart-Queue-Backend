import { Controller, Post, Get, Body, UseGuards, Req, Param } from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './services.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER', 'SUPER_ADMIN')
  @Post()
  async create(@Req() req, @Body() dto: CreateServiceDto) {
    const data = await this.servicesService.create(req.user.id, dto);
    return { status: true, message: 'Service created', data, error: null };
  }

  @UseGuards(JwtAuthGuard)
  @Get('business/:businessId')
  async getByBusinessId(@Param('businessId') businessId: string) {
    const data = await this.servicesService.findByBusinessId(businessId);
    return { status: true, message: 'Services fetched', data, error: null };
  }
}
