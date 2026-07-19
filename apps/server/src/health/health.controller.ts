import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';

/**
 * Enhanced health check with database connectivity verification.
 * Used by load balancers, Docker health checks, and monitoring.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'Domovník API',
        version: '0.0.1',
        database: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'degraded',
        service: 'Domovník API',
        version: '0.0.1',
        database: 'disconnected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('ready')
  @Public()
  async ready() {
    // Kubernetes readiness probe — check DB + any critical deps
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ready: true };
    } catch {
      return { ready: false };
    }
  }
}