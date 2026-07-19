import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(landlordId: string, dto: any) {
    return this.prisma.payment.create({
      data: {
        landlordId,
        tenancyId: dto.tenancyId,
        period: dto.period,
        amount: dto.amount,
        paidDate: dto.paidDate ? new Date(dto.paidDate) : null,
        method: dto.method ?? 'Prevod',
        sourceMeta: dto.sourceMetadata ?? null,
      },
      include: { tenancy: true },
    });
  }

  async findAll(landlordId: string, filters?: { tenancyId?: string; period?: string }) {
    const where: any = { landlordId };
    if (filters?.tenancyId) where.tenancyId = filters.tenancyId;
    if (filters?.period) where.period = filters.period;
    return this.prisma.payment.findMany({
      where,
      include: { tenancy: { include: { unit: true } } },
      orderBy: [{ period: 'desc' }, { paidDate: 'desc' }],
    });
  }

  async findOne(landlordId: string, id: string) {
    const p = await this.prisma.payment.findFirst({ where: { id, landlordId }, include: { tenancy: true } });
    if (!p) throw new NotFoundException('Platba nenalezena');
    return p;
  }

  async findByTenancy(landlordId: string, tenancyId: string) {
    return this.prisma.payment.findMany({
      where: { landlordId, tenancyId },
      orderBy: { period: 'desc' },
    });
  }

  async markPaid(landlordId: string, id: string, paidDate?: string) {
    await this.findOne(landlordId, id);
    return this.prisma.payment.update({
      where: { id },
      data: { paidDate: paidDate ? new Date(paidDate) : new Date(), method: 'Bankovni_vypis' },
    });
  }

  async undoPayment(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.payment.update({ where: { id }, data: { paidDate: null } });
  }

  async remove(landlordId: string, id: string) {
    await this.findOne(landlordId, id);
    return this.prisma.payment.delete({ where: { id } });
  }
}