import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(landlordId: string) {
    let settings = await this.prisma.landlordSettings.findUnique({ where: { landlordId } });
    if (!settings) {
      settings = await this.prisma.landlordSettings.create({ data: { landlordId } });
    }
    return settings;
  }

  async update(landlordId: string, dto: { autonomy?: string; notifyOnNewRequest?: boolean; notifyOnEmergency?: boolean }) {
    await this.get(landlordId);
    return this.prisma.landlordSettings.update({
      where: { landlordId },
      data: { ...dto, autonomy: dto.autonomy as any },
    });
  }
}