import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto, UpdateBusinessDto } from './businesses.dto';
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
  @Roles('BUSINESS_OWNER', 'SUPER_ADMIN')
  @Patch(':id')
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    const data = await this.businessesService.update(id, req.user.id, dto);
    return { status: true, message: 'Business updated', data, error: null };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER', 'SUPER_ADMIN')
  @Delete(':id')
  async delete(
    @Req() req,
    @Param('id') id: string,
  ) {
    await this.businessesService.delete(id, req.user.id);
    return { status: true, message: 'Business deleted successfully', data: null, error: null };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER', 'SUPER_ADMIN')
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
  }))
  async uploadLogo(
    @Req() req,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.businessesService.uploadLogo(id, req.user.id, file);
    return { status: true, message: 'Logo uploaded successfully', data, error: null };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER')
  @Post(':id/operators')
  async addOperator(
    @Req() req,
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    const data = await this.businessesService.addOperator(id, req.user.id, email);
    return { status: true, message: 'Operator added successfully', data, error: null };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUSINESS_OWNER', 'OPERATOR')
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
  async search(
    @Query('q') query: string,
    @Query('category') category?: string,
  ) {
    const data = await this.businessesService.searchBusinesses(query || '', category);
    return { status: true, message: 'Search results', data, error: null };
  }

  @UseGuards(JwtAuthGuard)
  @Get('nearby')
  async getNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('category') category?: string,
  ) {
    const latitude = parseFloat(lat) || 37.7749;
    const longitude = parseFloat(lng) || -122.4194;
    const radiusKm = radius ? parseFloat(radius) : 50;
    const data = await this.businessesService.getNearbyBusinesses(
      latitude,
      longitude,
      radiusKm,
      category,
    );
    return {
      status: true,
      message: 'Nearby businesses found',
      data,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    const data = await this.businessesService.getById(id);
    return { status: true, message: 'Business details', data, error: null };
  }
}
