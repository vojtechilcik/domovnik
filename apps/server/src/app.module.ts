import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './common/guards/roles.guard.js';
import { UnitsModule } from './units/units.module.js';
import { TenanciesModule } from './tenancies/tenancies.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { InspectionsModule } from './inspections/inspections.module.js';
import { SettlementsModule } from './settlements/settlements.module.js';
import { RepairRequestsModule } from './repair-requests/repair-requests.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { BankModule } from './bank/bank.module.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UnitsModule,
    TenanciesModule,
    PaymentsModule,
    InspectionsModule,
    SettlementsModule,
    RepairRequestsModule,
    MessagesModule,
    BankModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard('jwt') },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
