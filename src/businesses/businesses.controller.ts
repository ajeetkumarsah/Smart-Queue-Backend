import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
  Param,
} from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './businesses.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER', 'SUPER_ADMIN')
  @Post()
  async create(@Req() req, @Body() dto: CreateBusinessDto) {
    const data = await this.businessesService.create(req.user.id, dto);
    return { status: true, message: 'Business created', data, error: null };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER')
  @Get('my')
  async getMyBusinesses(@Req() req) {
    const data = await this.businessesService.findMyBusinesses(req.user.id);
    return {
      status: true,
      message: 'Fetched my businesses',
      data,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(@Query('q') query: string) {
    const data = await this.businessesService.searchBusinesses(query || '');
    return { status: true, message: 'Search results', data, error: null };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    const data = await this.businessesService.getById(id);
    return { status: true, message: 'Business details', data, error: null };
  }
}
