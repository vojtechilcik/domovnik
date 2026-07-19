import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InspectionsService } from './inspections.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Inspections')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  @Get()
  @Roles('LANDLORD')
  findAll(@Req() req: any) { return this.service.findAll(req.user.id); }

  @Get(':id')
  @Roles('LANDLORD')
  findOne(@Req() req: any, @Param('id') id: string) { return this.service.findOne(req.user.id, id); }

  @Post()
  @Roles('LANDLORD')
  create(@Req() req: any, @Body() body: any) { return this.service.create(req.user.id, body); }

  @Patch(':id')
  @Roles('LANDLORD')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.update(req.user.id, id, body); }

  @Post(':id/done')
  @Roles('LANDLORD')
  markDone(@Req() req: any, @Param('id') id: string) { return this.service.markDone(req.user.id, id); }

  @Post(':id/undo')
  @Roles('LANDLORD')
  undoDone(@Req() req: any, @Param('id') id: string) { return this.service.undoDone(req.user.id, id); }

  @Delete(':id')
  @Roles('LANDLORD')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user.id, id); }
}