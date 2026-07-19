import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(landlordId: string, dto: { name: string; address: string; areaM2: number; type: string }) {
    return this.prisma.unit.create({
      data: { landlordId, name: dto.name, address: dto.address, areaM2: dto.areaM2, type: dto.type as any },
    });
  }

  async findAll(landlordId: string) {
    return this.prisma.unit.findMany({
      where: { landlordId },
      include: { tenancies: { include: { tenantUser: { select: { name: true, email: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(landlordId: string, id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, landlordId },
      include: { tenancies: true, inspections: true },
    });
    if (!unit) throw new NotFoundException('Jednotka nenalezena');
    return unit;
  }

  async update(landlordId: string, id: string, dto: Partial<{ name: string; address: string; areaM2: number; type: string }>) {
    await this.findOne(landlordId, id);
    return this.prisma.unit.update({ where: { id }, data: { ...dto, type: dto.type as any } });
  }

  async remove(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.unit.delete({ where: { id } });
  }
}