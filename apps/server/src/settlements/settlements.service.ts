import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenanciesService } from '../tenancies/tenancies.service.js';
import { activeMonthsInYear } from '@domovnik/core';

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenanciesService: TenanciesService,
  ) {}

  async create(landlordId: string, dto: any) {
    return this.prisma.settlement.create({
      data: {
        landlordId, unitId: dto.unitId, year: dto.year,
        tenantName: dto.tenantName, advancesTotal: dto.advancesTotal,
        costs: dto.costs ?? [],
      },
    });
  }

  async findAll(landlordId: string, year?: number) {
    const where: any = { landlordId };
    if (year) where.year = year;
    return this.prisma.settlement.findMany({ where, include: { unit: true }, orderBy: { year: 'desc' } });
  }

  async findOne(landlordId: string, id: string) {
    const s = await this.prisma.settlement.findFirst({ where: { id, landlordId }, include: { unit: true } });
    if (!s) throw new NotFoundException('Vyúčtování nenalezeno');
    return s;
  }

  async computeAdvances(landlordId: string, tenancyId: string, year: number) {
    const tenancy = await this.tenanciesService.findOne(landlordId, tenancyId);
    const months = activeMonthsInYear({ ...tenancy, leaseStart: tenancy.leaseStart.toISOString().slice(0, 10), leaseEnd: tenancy.leaseEnd?.toISOString().slice(0, 10) ?? null } as any, year);
    return { tenancyId, year, activeMonths: months, monthlyAdvance: tenancy.serviceAdvances, total: months * tenancy.serviceAdvances };
  }

  async update(landlordId: string, id: string, dto: any) {
    await this.findOne(landlordId, id);
    return this.prisma.settlement.update({ where: { id }, data: dto });
  }

  async remove(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.settlement.delete({ where: { id } });
  }
}