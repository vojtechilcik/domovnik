import { Module } from '@nestjs/common';
import { BankService } from './bank.service.js';
import { BankController } from './bank.controller.js';

@Module({
  controllers: [BankController],
  providers: [BankService],
  exports: [BankService],
})
export class BankModule {}