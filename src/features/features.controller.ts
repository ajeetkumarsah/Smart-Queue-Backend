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
import { FeaturesService } from './features.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeatureEntity } from './features.entity';

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  async getAllFeatures() {
    const features = await this.featuresService.getAllFeatures();
    return {
      status: true,
      message: 'Features fetched',
      messageType: 'none',
      data: features,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Patch('reorder')
  async reorderFeatures(
    @Body('items') items: { id: string; display_order: number }[],
  ) {
    if (!items || !Array.isArray(items)) {
      return {
        status: false,
        message: 'Invalid items array',
        messageType: 'toast',
        data: null,
        error: 'Bad Request',
      };
    }
    await this.featuresService.reorderFeatures(items);
    return {
      status: true,
      message: 'Features reordered successfully',
      messageType: 'toast',
      data: null,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post()
  async createFeature(@Body() data: Partial<FeatureEntity>) {
    const feature = await this.featuresService.createFeature(data);
    return {
      status: true,
      message: 'Feature created successfully',
      messageType: 'toast',
      data: feature,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Patch(':id')
  async updateFeature(
    @Param('id') id: string,
    @Body() data: Partial<FeatureEntity>,
  ) {
    const feature = await this.featuresService.updateFeature(id, data);
    return {
      status: true,
      message: 'Feature updated successfully',
      messageType: 'toast',
      data: feature,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Delete(':id')
  async deleteFeature(@Param('id') id: string) {
    await this.featuresService.deleteFeature(id);
    return {
      status: true,
      message: 'Feature deleted successfully',
      messageType: 'toast',
      data: null,
      error: null,
    };
  }
}
