import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';

import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
  exports: [NotificationsRepository], // Export for QueueProcessor
})
export class NotificationsModule {}
