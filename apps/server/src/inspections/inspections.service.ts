import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InspectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(landlordId: string, dto: any) {
    return this.prisma.inspection.create({
      data: {
        landlordId,
        unitId: dto.unitId,
        type: dto.type,
        dueDate: new Date(dto.dueDate),
        done: dto.done ?? false,
        note: dto.note ?? null,
      },
      include: { unit: true },
    });
  }

  async findAll(landlordId: string) {
    return this.prisma.inspection.findMany({
      where: { landlordId },
      include: { unit: true },
      orderBy: [{ done: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async findOne(landlordId: string, id: string) {
    const i = await this.prisma.inspection.findFirst({ where: { id, landlordId }, include: { unit: true } });
    if (!i) throw new NotFoundException('Revize nenalezena');
    return i;
  }

  async update(landlordId: string, id: string, dto: any) {
    await this.findOne(landlordId, id);
    const data: any = { ...dto };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    delete data.id; delete data.landlordId;
    return this.prisma.inspection.update({ where: { id }, data, include: { unit: true } });
  }

  async markDone(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.inspection.update({ where: { id }, data: { done: true } });
  }

  async undoDone(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.inspection.update({ where: { id }, data: { done: false } });
  }

  async remove(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.inspection.delete({ where: { id } });
  }
}