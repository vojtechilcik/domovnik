import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Získat nastavení pronajímatele' })
  get(@Req() req: any) { return this.service.get(req.user.id); }

  @Patch()
  @Roles('LANDLORD')
  @ApiOperation({ summary: 'Aktualizovat nastavení (autonomie agenta, notifikace)' })
  update(@Req() req: any, @Body() body: any) { return this.service.update(req.user.id, body); }
}