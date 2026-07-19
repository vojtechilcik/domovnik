import { Module } from '@nestjs/common';
import { RepairRequestsService } from './repair-requests.service.js';
import { RepairRequestsController } from './repair-requests.controller.js';
import { MessagesModule } from '../messages/messages.module.js';

@Module({
  imports: [MessagesModule],
  controllers: [RepairRequestsController],
  providers: [RepairRequestsService],
  exports: [RepairRequestsService],
})
export class RepairRequestsModule {}