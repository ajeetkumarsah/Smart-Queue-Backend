import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { QueuesRepository } from './queues.repository';
import { QueueProcessor } from './queue.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [QueuesService, QueuesRepository, QueueProcessor],
  controllers: [QueuesController],
})
export class QueuesModule {}

