import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: { email: string; password: string; name: string; role: 'LANDLORD' | 'TENANT' }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email již existuje');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role,
      },
    });

    // If landlord, auto-create settings
    if (dto.role === 'LANDLORD') {
      await this.prisma.landlordSettings.create({
        data: { landlordId: user.id },
      });
    }

    return this.tokensForUser(user.id, user.email, user.role);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Neplatný email nebo heslo');

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Neplatný email nebo heslo');

    return this.tokensForUser(user.id, user.email, user.role);
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload: { sub: string; email: string; role: string; type: string } =
        this.jwtService.verify(refreshToken, { secret: process.env['JWT_REFRESH_SECRET'] });

      if (payload.type !== 'refresh') throw new UnauthorizedException();

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();

      return this.tokensForUser(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Neplatný refresh token');
    }
  }

  async inviteTenant(landlordId: string, dto: { email: string; tenancyId: string }) {
    // Verify tenancy belongs to this landlord
    const tenancy = await this.prisma.tenancy.findFirst({
      where: { id: dto.tenancyId, landlordId },
    });
    if (!tenancy) throw new NotFoundException('Nájemní smlouva nenalezena');

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.inviteToken.create({
      data: {
        email: dto.email,
        tenancyId: dto.tenancyId,
        token,
        expiresAt,
      },
    });

    // In production, send email here. For now, return the token.
    return { token, expiresAt, message: `Pozvánka odeslána na ${dto.email}` };
  }

  async acceptInvite(token: string, password: string) {
    const invite = await this.prisma.inviteToken.findUnique({ where: { token } });
    if (!invite || invite.used || invite.expiresAt < new Date()) {
      throw new BadRequestException('Neplatný nebo expirovaný token');
    }

    // Create tenant user
    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: {
        email: invite.email,
        passwordHash,
        name: invite.email.split('@')[0] ?? 'Nájemník',
        role: 'TENANT',
      },
    });

    // Link to tenancy
    await this.prisma.tenancy.update({
      where: { id: invite.tenancyId },
      data: { tenantUserId: user.id },
    });

    // Mark token used
    await this.prisma.inviteToken.update({
      where: { id: invite.id },
      data: { used: true },
    });

    return this.tokensForUser(user.id, user.email, user.role);
  }

  private tokensForUser(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env['JWT_SECRET'] ?? 'dev-secret',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: process.env['JWT_REFRESH_SECRET'] ?? 'dev-refresh-secret',
        expiresIn: '7d',
      },
    );

    return { accessToken, refreshToken };
  }
}