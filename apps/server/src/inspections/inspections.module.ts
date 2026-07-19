import { Module } from '@nestjs/common';
import { InspectionsService } from './inspections.service.js';
import { InspectionsController } from './inspections.controller.js';

@Module({
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}