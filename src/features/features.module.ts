import { Module } from '@nestjs/common';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';
import { FeaturesRepository } from './features.repository';

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService, FeaturesRepository],
  exports: [FeaturesService],
})
export class FeaturesModule {}
