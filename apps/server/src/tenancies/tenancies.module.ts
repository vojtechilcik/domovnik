import { Module } from '@nestjs/common';
import { TenanciesService } from './tenancies.service.js';
import { TenanciesController } from './tenancies.controller.js';

@Module({
  controllers: [TenanciesController],
  providers: [TenanciesService],
  exports: [TenanciesService],
})
export class TenanciesModule {}