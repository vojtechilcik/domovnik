import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UnitsService } from './units.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Vypsat všechny jednotky pronajímatele' })
  findAll(@Req() req: any) {
    return this.unitsService.findAll(req.user.id);
  }

  @Get(':id')
  @Roles('LANDLORD', 'TENANT')
  @ApiOperation({ summary: 'Detail jednotky' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.unitsService.findOne(req.user.id, id);
  }

  @Post()
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Vytvořit novou jednotku' })
  create(@Req() req: any, @Body() body: any) {
    return this.unitsService.create(req.user.id, body);
  }

  @Patch(':id')
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Upravit jednotku' })
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.unitsService.update(req.user.id, id, body);
  }

  @Delete(':id')
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Smazat jednotku' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.unitsService.remove(req.user.id, id);
  }
}