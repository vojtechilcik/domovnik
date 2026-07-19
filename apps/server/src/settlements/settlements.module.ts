import { Module } from '@nestjs/common';
import { SettlementsService } from './settlements.service.js';
import { SettlementsController } from './settlements.controller.js';
import { TenanciesModule } from '../tenancies/tenancies.module.js';

@Module({
  imports: [TenanciesModule],
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}