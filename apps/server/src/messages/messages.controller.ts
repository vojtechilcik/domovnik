import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('messages')
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Get(':repairRequestId')
  @Roles('LANDLORD', 'TENANT')
  findByRequest(@Param('repairRequestId') id: string) {
    return this.service.findByRequest(id);
  }

  @Post(':repairRequestId')
  @Roles('LANDLORD', 'TENANT')
  create(@Param('repairRequestId') id: string, @Body() body: { from: string; text: string }) {
    return this.service.create(id, body);
  }
}