import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RepairRequestsService } from './repair-requests.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Repair Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('repair-requests')
export class RepairRequestsController {
  constructor(private readonly service: RepairRequestsService) {}

  @Get()
  @Roles('LANDLORD')
  findAll(@Req() req: any) { return this.service.findAll(req.user.id); }

  @Get('tenant')
  @Roles('TENANT')
  findByTenant(@Req() req: any) { return this.service.findByTenant(req.user.id); }

  @Get(':id')
  @Roles('LANDLORD', 'TENANT')
  findOne(@Req() req: any, @Param('id') id: string) {
    if (req.user.role === 'TENANT') return this.service.findOneForTenant(req.user.id, id);
    return this.service.findOne(req.user.id, id);
  }

  @Post()
  @Roles('LANDLORD', 'TENANT')
  create(@Req() req: any, @Body() body: any) {
    if (req.user.role === 'TENANT') return this.service.createByTenant(body.tenancyId, req.user.id, body);
    return this.service.create(req.user.id, body);
  }

  @Post(':id/status')
  @Roles('LANDLORD')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(req.user.id, id, body.status);
  }
}