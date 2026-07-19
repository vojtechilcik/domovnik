import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(repairRequestId: string, dto: { from: string; text: string }) {
    return this.prisma.message.create({
      data: { repairRequestId, from: dto.from as any, text: dto.text },
    });
  }

  async findByRequest(repairRequestId: string) {
    return this.prisma.message.findMany({
      where: { repairRequestId },
      orderBy: { at: 'asc' },
    });
  }
}