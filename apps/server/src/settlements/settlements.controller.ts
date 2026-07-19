import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettlementsService } from './settlements.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Settlements')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly service: SettlementsService) {}

  @Get()
  @Roles('LANDLORD')
  findAll(@Req() req: any, @Query('year') year?: string) {
    return this.service.findAll(req.user.id, year ? Number(year) : undefined);
  }

  @Get(':id')
  @Roles('LANDLORD')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req.user.id, id); }

  @Post()
  @Roles('LANDLORD')
  create(@Req() req: any, @Body() body: any) { return this.service.create(req.user.id, body); }

  @Post('compute-advances')
  @Roles('LANDLORD')
  computeAdvances(@Req() req: any, @Body() body: { tenancyId: string; year: number }) {
    return this.service.computeAdvances(req.user.id, body.tenancyId, body.year);
  }

  @Patch(':id')
  @Roles('LANDLORD')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.update(req.user.id, id, body); }

  @Delete(':id')
  @Roles('LANDLORD')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user.id, id); }
}