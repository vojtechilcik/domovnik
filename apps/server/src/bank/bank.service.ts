import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseStatement, matchStatement, getPreselected } from '@domovnik/core';
import type { ParsedStatementRow, Tenancy as CoreTenancy, Payment as CorePayment } from '@domovnik/core';

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

  async importStatement(landlordId: string, raw: string) {
    // Parse using packages/core parser
    const rows = parseStatement(raw);
    if (rows.length === 0) throw new BadRequestException('Výpis neobsahuje žádné rozpoznané transakce');

    // Load tenancies and existing payments for matching
    const tenancies = await this.prisma.tenancy.findMany({
      where: { landlordId },
      include: { unit: true },
    });

    const existingPayments = await this.prisma.payment.findMany({
      where: { landlordId },
    });

    // Map to core types (date handling)
    const coreTenancies: CoreTenancy[] = tenancies.map((t) => ({
      ...t,
      leaseStart: t.leaseStart.toISOString().slice(0, 10),
      leaseEnd: t.leaseEnd?.toISOString().slice(0, 10) ?? null,
      tenantUserId: t.tenantUserId,
      tenantName: t.tenantName,
    }));

    const corePayments: CorePayment[] = existingPayments.map((p) => ({
      ...p,
      paidDate: p.paidDate?.toISOString().slice(0, 10) ?? null,
    }));

    const results = matchStatement(rows, coreTenancies, corePayments);

    // Store matched transactions in DB
    const bankTransactions = [];
    for (const result of results) {
      const bt = await this.prisma.bankTransaction.create({
        data: {
          landlordId,
          date: new Date(result.row.date),
          amount: result.row.amount,
          vs: result.row.vs,
          counterparty: result.row.counterparty,
          message: result.row.message,
          matchStatus: result.classification as any,
        },
      });
      bankTransactions.push({ ...result, bankTransactionId: bt.id });
    }

    return { rows, results: bankTransactions };
  }

  async bookSelected(landlordId: string, bankTransactionIds: string[]) {
    const bookings = [];
    for (const btId of bankTransactionIds) {
      const bt = await this.prisma.bankTransaction.findFirst({
        where: { id: btId, landlordId },
      });
      if (!bt) continue;

      // Find the matched tenancy again to create a payment
      const tenancy = await this.prisma.tenancy.findFirst({
        where: { landlordId, variableSymbol: bt.vs ?? '' },
      });

      if (!tenancy) continue;

      const payment = await this.prisma.payment.create({
        data: {
          landlordId,
          tenancyId: tenancy.id,
          period: bt.date.toISOString().slice(0, 7),
          amount: Math.round(bt.amount),
          paidDate: bt.date,
          method: 'Bankovni_vypis',
          sourceMeta: {
            counterpartyName: bt.counterparty,
            vs: bt.vs,
            bankTransactionId: bt.id,
          },
        },
      });

      await this.prisma.bankTransaction.update({
        where: { id: bt.id },
        data: { linkedPaymentId: payment.id },
      });

      bookings.push(payment);
    }
    return bookings;
  }
}