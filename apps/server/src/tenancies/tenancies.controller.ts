import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenanciesService } from './tenancies.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Tenancies')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('tenancies')
export class TenanciesController {
  constructor(private readonly service: TenanciesService) {}

  @Get()
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Seznam nájemních smluv' })
  findAll(@Req() req: any) { return this.service.findAll(req.user.id); }

  @Get(':id')
  @Roles('LANDLORD', 'TENANT')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req.user.id, id); }

  @Post()
  @Roles('LANDLORD')
  create(@Req() req: any, @Body() body: any) { return this.service.create(req.user.id, body); }

  @Patch(':id')
  @Roles('LANDLORD')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.update(req.user.id, id, body); }

  @Delete(':id')
  @Roles('LANDLORD')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user.id, id); }

  @Post(':id/indexace/preview')
  @Roles('LANDLORD')
  previewIndexation(@Req() req: any, @Param('id') id: string, @Body() body: { cpiPercent: number }) {
    return this.service.runIndexation(req.user.id, id, body.cpiPercent);
  }

  @Post(':id/indexace/apply')
  @Roles('LANDLORD')
  applyIndexation(@Req() req: any, @Param('id') id: string, @Body() body: { cpiPercent: number }) {
    return this.service.applyIndexation(req.user.id, id, body.cpiPercent);
  }
}