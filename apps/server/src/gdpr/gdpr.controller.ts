import { Controller, Post, Delete, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';

/**
 * GDPR compliance endpoints — data export and right-to-erasure.
 * Both LANDLORD and TENANT can access their own data.
 */
@ApiTags('GDPR')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gdpr')
export class GdprController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('export')
  @Roles('LANDLORD', 'TENANT')
  @ApiOperation({ summary: 'Exportovat všechna data aktuálního uživatele (GDPR čl. 20)' })
  async exportData(@Req() req: any) {
    const userId = req.user.id;

    const [user, tenancies, payments, repairRequests, messages, settings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, phone: true, role: true, locale: true, createdAt: true } }),
      this.prisma.tenancy.findMany({ where: { OR: [{ landlordId: userId }, { tenantUserId: userId }] } }),
      this.prisma.payment.findMany({ where: { OR: [{ landlordId: userId }, { tenancy: { tenantUserId: userId } }] } }),
      this.prisma.repairRequest.findMany({ where: { OR: [{ landlordId: userId }, { tenancy: { tenantUserId: userId } }] }, include: { messages: true } }),
      this.prisma.message.findMany({ where: { repairRequest: { OR: [{ landlordId: userId }, { tenancy: { tenantUserId: userId } }] } } }),
      req.user.role === 'LANDLORD' ? this.prisma.landlordSettings.findUnique({ where: { landlordId: userId } }) : null,
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      tenancies,
      payments,
      repairRequests,
      messages,
      settings,
    };
  }

  @Delete('erase')
  @Roles('LANDLORD', 'TENANT')
  @ApiOperation({ summary: 'Smazat všechna data aktuálního uživatele (GDPR čl. 17 — právo být zapomenut)' })
  async eraseData(@Req() req: any) {
    const userId = req.user.id;

    if (req.user.role === 'TENANT') {
      // Delete tenant's messages first, then repair requests they created, then their tenancy link
      const tenancy = await this.prisma.tenancy.findUnique({ where: { tenantUserId: userId } });
      if (tenancy) {
        await this.prisma.message.deleteMany({ where: { repairRequest: { tenancyId: tenancy.id } } });
        await this.prisma.repairRequest.deleteMany({ where: { tenancyId: tenancy.id } });
        await this.prisma.tenancy.update({ where: { id: tenancy.id }, data: { tenantUserId: null } });
      }
    } else {
      // Landlord: delete all their data cascade
      await this.prisma.message.deleteMany({ where: { repairRequest: { landlordId: userId } } });
      await this.prisma.repairRequest.deleteMany({ where: { landlordId: userId } });
      await this.prisma.bankTransaction.deleteMany({ where: { landlordId: userId } });
      await this.prisma.payment.deleteMany({ where: { landlordId: userId } });
      await this.prisma.settlement.deleteMany({ where: { landlordId: userId } });
      await this.prisma.inspection.deleteMany({ where: { landlordId: userId } });
      await this.prisma.tenancy.deleteMany({ where: { landlordId: userId } });
      await this.prisma.landlordSettings.deleteMany({ where: { landlordId: userId } });
      await this.prisma.unit.deleteMany({ where: { landlordId: userId } });
    }

    // Delete the user account
    await this.prisma.user.delete({ where: { id: userId } });

    return { erased: true, userId, message: 'Všechna data byla smazána v souladu s GDPR.' };
  }
}