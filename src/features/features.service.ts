import { Injectable, NotFoundException } from '@nestjs/common';
import { FeaturesRepository } from './features.repository';
import { FeatureEntity } from './features.entity';

@Injectable()
export class FeaturesService {
  constructor(private readonly featuresRepo: FeaturesRepository) {}

  async getAllFeatures(): Promise<FeatureEntity[]> {
    return this.featuresRepo.findAll();
  }

  async createFeature(data: Partial<FeatureEntity>): Promise<FeatureEntity> {
    return this.featuresRepo.create(data);
  }

  async updateFeature(id: string, data: Partial<FeatureEntity>): Promise<FeatureEntity> {
    const updated = await this.featuresRepo.update(id, data);
    if (!updated) {
      throw new NotFoundException('Feature not found');
    }
    return updated;
  }

  async deleteFeature(id: string): Promise<void> {
    await this.featuresRepo.delete(id);
  }
}
