import { Controller, Get, Post, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  @Roles('LANDLORD', 'TENANT')
  @ApiOperation({ summary: 'Seznam plateb (lze filtrovat dle tenancyId a period)' })
  findAll(@Req() req: any, @Query('tenancyId') tenancyId?: string, @Query('period') period?: string) {
    return this.service.findAll(req.user.id, { tenancyId, period });
  }

  @Post()
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Vytvořit platbu' })
  create(@Req() req: any, @Body() body: any) { return this.service.create(req.user.id, body); }

  @Get(':id')
  @Roles('LANDLORD', 'TENANT')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req.user.id, id); }

  @Post(':id/mark-paid')
  @Roles('LANDLORD')
  markPaid(@Req() req: any, @Param('id') id: string, @Body() body: { paidDate?: string }) {
    return this.service.markPaid(req.user.id, id, body.paidDate);
  }

  @Post(':id/undo')
  @Roles('LANDLORD')
  undo(@Req() req: any, @Param('id') id: string) { return this.service.undoPayment(req.user.id, id); }

  @Delete(':id')
  @Roles('LANDLORD')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user.id, id); }
}