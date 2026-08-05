import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { BusinessesRepository } from './businesses.repository';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [CloudinaryModule, SubscriptionsModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessesRepository],
  exports: [BusinessesService],
})
export class BusinessesModule {}
