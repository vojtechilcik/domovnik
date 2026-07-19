import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TenanciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(landlordId: string, dto: any) {
    return this.prisma.tenancy.create({
      data: {
        landlordId,
        unitId: dto.unitId,
        tenantName: dto.tenantName,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        rent: dto.rent,
        serviceAdvances: dto.serviceAdvances,
        deposit: dto.deposit ?? null,
        variableSymbol: dto.variableSymbol,
        leaseStart: new Date(dto.leaseStart),
        leaseEnd: dto.leaseEnd ? new Date(dto.leaseEnd) : null,
      },
      include: { unit: true },
    });
  }

  async findAll(landlordId: string) {
    return this.prisma.tenancy.findMany({
      where: { landlordId },
      include: { unit: true, tenantUser: { select: { id: true, name: true, email: true } } },
      orderBy: { tenantName: 'asc' },
    });
  }

  async findOne(landlordId: string, id: string) {
    const t = await this.prisma.tenancy.findFirst({
      where: { id, landlordId },
      include: { unit: true, payments: true, tenantUser: { select: { id: true, name: true, email: true } } },
    });
    if (!t) throw new NotFoundException('Nájemní smlouva nenalezena');
    return t;
  }

  async findByUnit(landlordId: string, unitId: string) {
    return this.prisma.tenancy.findMany({
      where: { landlordId, unitId },
      include: { unit: true },
    });
  }

  async update(landlordId: string, id: string, dto: any) {
    await this.findOne(landlordId, id);
    const data: any = { ...dto };
    if (dto.leaseStart) data.leaseStart = new Date(dto.leaseStart);
    if (dto.leaseEnd !== undefined) data.leaseEnd = dto.leaseEnd ? new Date(dto.leaseEnd) : null;
    delete data.id; delete data.landlordId; delete data.unitId;
    return this.prisma.tenancy.update({ where: { id }, data, include: { unit: true } });
  }

  async remove(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.tenancy.delete({ where: { id } });
  }

  async runIndexation(landlordId: string, id: string, cpiPercent: number) {
    const t = await this.findOne(landlordId, id);
    const increase = Math.round((t.rent * cpiPercent) / 100);
    const newRent = t.rent + increase;
    return { oldRent: t.rent, increase, newRent };
  }

  async applyIndexation(landlordId: string, id: string, cpiPercent: number) {
    const result = await this.runIndexation(landlordId, id, cpiPercent);
    await this.prisma.tenancy.update({ where: { id }, data: { rent: result.newRent } });
    return result;
  }
}