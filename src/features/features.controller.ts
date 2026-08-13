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
    return { status: true, data: features };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post()
  async createFeature(@Body() data: Partial<FeatureEntity>) {
    const feature = await this.featuresService.createFeature(data);
    return { data: feature, message: 'Feature created successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Patch(':id')
  async updateFeature(
    @Param('id') id: string,
    @Body() data: Partial<FeatureEntity>,
  ) {
    const feature = await this.featuresService.updateFeature(id, data);
    return { data: feature, message: 'Feature updated successfully' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Delete(':id')
  async deleteFeature(@Param('id') id: string) {
    await this.featuresService.deleteFeature(id);
    return { message: 'Feature deleted successfully' };
  }
}
