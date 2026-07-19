import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RepairRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(landlordId: string, dto: any) {
    return this.prisma.repairRequest.create({
      data: {
        landlordId, unitId: dto.unitId, tenancyId: dto.tenancyId,
        category: dto.category, description: dto.description,
        photoUrls: dto.photoUrls ?? [], status: 'Zpracovava_se',
      },
      include: { unit: true, tenancy: true, messages: true },
    });
  }

  async createByTenant(tenancyId: string, tenantUserId: string, dto: any) {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { id: tenancyId } });
    if (!tenancy || tenancy.tenantUserId !== tenantUserId) throw new ForbiddenException();
    return this.create(tenancy.landlordId, { unitId: tenancy.unitId, tenancyId, ...dto });
  }

  async findAll(landlordId: string) {
    return this.prisma.repairRequest.findMany({
      where: { landlordId },
      include: { unit: true, tenancy: true, messages: { orderBy: { at: 'asc' } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findByTenant(tenantUserId: string) {
    const tenancy = await this.prisma.tenancy.findUnique({ where: { tenantUserId } });
    if (!tenancy) throw new NotFoundException('Nájemní smlouva nenalezena');
    return this.prisma.repairRequest.findMany({
      where: { tenancyId: tenancy.id },
      include: { unit: true, messages: { orderBy: { at: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(landlordId: string, id: string) {
    const r = await this.prisma.repairRequest.findFirst({
      where: { id, landlordId },
      include: { unit: true, tenancy: true, messages: { orderBy: { at: 'asc' } } },
    });
    if (!r) throw new NotFoundException('Závada nenalezena');
    return r;
  }

  async findOneForTenant(tenantUserId: string, id: string) {
    const r = await this.prisma.repairRequest.findUnique({ where: { id }, include: { unit: true, messages: { orderBy: { at: 'asc' } } } });
    if (!r) throw new NotFoundException();
    const tenancy = await this.prisma.tenancy.findUnique({ where: { tenantUserId } });
    if (!tenancy || r.tenancyId !== tenancy.id) throw new ForbiddenException();
    return r;
  }

  async updateStatus(landlordId: string, id: string, status: string) {
    await this.findOne(landlordId, id);
    return this.prisma.repairRequest.update({ where: { id }, data: { status: status as any } });
  }

  async addAgentLog(landlordId: string, id: string, entry: { detail: string; at: string }) {
    const req = await this.findOne(landlordId, id);
    return this.prisma.repairRequest.update({
      where: { id },
      data: { agentLog: { push: entry } },
    });
  }

  async setTriage(landlordId: string, id: string, triage: any) {
    return this.prisma.repairRequest.update({ where: { id }, data: { triage } });
  }

  async setDrafts(landlordId: string, id: string, drafts: { enquiryDraft?: string; tenantDraft?: string; aiSolution?: string }) {
    return this.prisma.repairRequest.update({ where: { id }, data: drafts });
  }
}