import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>(ROLES_KEY, context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: { id: string; email: string; role: UserRole } }>();
    if (!req.user) throw new ForbiddenException('Unauthenticated');

    const hasRole = requiredRoles.includes(req.user.role);
    if (!hasRole) throw new ForbiddenException('Nedostatečná oprávnění');

    return true;
  }
}