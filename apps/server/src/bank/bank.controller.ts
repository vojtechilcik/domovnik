import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BankService } from './bank.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Bank')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('bank')
export class BankController {
  constructor(private readonly service: BankService) {}

  @Post('import')
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Importovat bankovní výpis (CSV/ABO) — parser z packages/core' })
  import(@Req() req: any, @Body() body: { raw: string }) {
    return this.service.importStatement(req.user.id, body.raw);
  }

  @Post('book')
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Zaúčtovat vybrané bankovní transakce jako platby' })
  book(@Req() req: any, @Body() body: { bankTransactionIds: string[] }) {
    return this.service.bookSelected(req.user.id, body.bankTransactionIds);
  }
}