import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { QueuesRepository } from './queues.repository';
import { QueueProcessor } from './queue.processor';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    EventsModule,
    NotificationsModule,
    BusinessesModule,
  ],
  providers: [QueuesService, QueuesRepository, QueueProcessor],
  controllers: [QueuesController],
})
export class QueuesModule {}
