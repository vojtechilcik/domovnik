import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Domovník demo data...');

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.repairRequest.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.inviteToken.deleteMany();
  await prisma.tenancy.deleteMany();
  await prisma.landlordSettings.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.user.deleteMany();

  // --- Landlord ---
  const landlordHash = await argon2.hash('heslo123');
  const landlord = await prisma.user.create({
    data: {
      email: 'jan.novak@email.cz',
      passwordHash: landlordHash,
      role: 'LANDLORD',
      name: 'Jan Novák',
      phone: '+420 777 123 456',
      locale: 'cs-CZ',
    },
  });

  await prisma.landlordSettings.create({
    data: {
      landlordId: landlord.id,
      autonomy: 'auto',
      notifyOnNewRequest: true,
      notifyOnEmergency: true,
    },
  });

  // --- Tenants (users) ---
  const tenantHash = await argon2.hash('heslo123');
  const petra = await prisma.user.create({
    data: { email: 'petra@email.cz', passwordHash: tenantHash, role: 'TENANT', name: 'Petra Nováková' },
  });
  const tereza = await prisma.user.create({
    data: { email: 'tereza@email.cz', passwordHash: tenantHash, role: 'TENANT', name: 'Tereza Horáková' },
  });
  const martin = await prisma.user.create({
    data: { email: 'martin@email.cz', passwordHash: tenantHash, role: 'TENANT', name: 'Martin Dvořák' },
  });

  // --- Units (4: Prague/Brno) ---
  const u1 = await prisma.unit.create({ data: { landlordId: landlord.id, name: 'Byt 2+kk', address: 'Sokolovská 45, Praha 8', areaM2: 62, type: 'Byt' } });
  const u2 = await prisma.unit.create({ data: { landlordId: landlord.id, name: 'Byt 2+kk', address: 'Veveří 12, Brno', areaM2: 54, type: 'Byt' } });
  const u3 = await prisma.unit.create({ data: { landlordId: landlord.id, name: 'Byt 3+1', address: 'Jugoslávská 20, Praha 2', areaM2: 78, type: 'Byt' } });
  const u4 = await prisma.unit.create({ data: { landlordId: landlord.id, name: 'Dům', address: 'Nad Lesem 5, Praha 4', areaM2: 140, type: 'Dum' } });

  // --- Tenancies (3 with VS codes from spec) ---
  const t1 = await prisma.tenancy.create({
    data: {
      landlordId: landlord.id, unitId: u1.id, tenantUserId: petra.id,
      tenantName: 'Petra Nováková', email: 'petra@email.cz',
      rent: 20000, serviceAdvances: 1700, deposit: 40000,
      variableSymbol: '1201', leaseStart: new Date('2026-01-01'), leaseEnd: null,
    },
  });
  const t2 = await prisma.tenancy.create({
    data: {
      landlordId: landlord.id, unitId: u2.id, tenantUserId: tereza.id,
      tenantName: 'Tereza Horáková', email: 'tereza@email.cz',
      rent: 13900, serviceAdvances: 2000, deposit: 27800,
      variableSymbol: '3304', leaseStart: new Date('2026-01-01'), leaseEnd: null,
    },
  });
  const t3 = await prisma.tenancy.create({
    data: {
      landlordId: landlord.id, unitId: u3.id, tenantUserId: martin.id,
      tenantName: 'Martin Dvořák', email: 'martin@email.cz',
      rent: 26100, serviceAdvances: 2000, deposit: 52200,
      variableSymbol: '8802', leaseStart: new Date('2026-01-01'), leaseEnd: null,
    },
  });

  // --- Payments (3 months) ---
  const months = [
    { period: '2026-05', date: '2026-05-05' },
    { period: '2026-06', date: '2026-06-05' },
    { period: '2026-07', date: '2026-07-05' },
  ];

  // Petra: paid May, June, July
  for (const m of months) {
    await prisma.payment.create({
      data: {
        landlordId: landlord.id, tenancyId: t1.id, period: m.period,
        amount: 21700, paidDate: new Date(m.date), method: 'Prevod',
        sourceMeta: { counterpartyName: 'Petra Nováková', vs: '1201' },
      },
    });
  }

  // Tereza: paid May, June — July unpaid
  for (const m of months.slice(0, 2)) {
    await prisma.payment.create({
      data: {
        landlordId: landlord.id, tenancyId: t2.id, period: m.period,
        amount: 15900, paidDate: new Date(m.date), method: 'Prevod',
        sourceMeta: { counterpartyName: 'Tereza Horáková', vs: '3304' },
      },
    });
  }
  // July marked as unpaid (no paidDate)
  await prisma.payment.create({
    data: {
      landlordId: landlord.id, tenancyId: t2.id, period: '2026-07',
      amount: 15900, paidDate: null, method: 'Prevod',
      sourceMeta: null,
    },
  });

  // Martin: paid May, June — July unpaid
  for (const m of months.slice(0, 2)) {
    await prisma.payment.create({
      data: {
        landlordId: landlord.id, tenancyId: t3.id, period: m.period,
        amount: 28100, paidDate: new Date(m.date), method: 'Prevod',
        sourceMeta: { counterpartyName: 'Martin Dvořák', vs: '8802' },
      },
    });
  }
  await prisma.payment.create({
    data: {
      landlordId: landlord.id, tenancyId: t3.id, period: '2026-07',
      amount: 28100, paidDate: null, method: 'Prevod',
      sourceMeta: null,
    },
  });

  // --- Inspections (4) ---
  await prisma.inspection.create({ data: { landlordId: landlord.id, unitId: u4.id, type: 'Kontrola_komina', dueDate: new Date('2024-08-03'), done: false, note: 'Naléhavé — již po termínu!' } });
  await prisma.inspection.create({ data: { landlordId: landlord.id, unitId: u2.id, type: 'Revize_plynu', dueDate: new Date('2026-08-15'), done: true } });
  await prisma.inspection.create({ data: { landlordId: landlord.id, unitId: u3.id, type: 'Revize_elektroinstalace', dueDate: new Date('2026-12-20'), done: false } });
  await prisma.inspection.create({ data: { landlordId: landlord.id, unitId: u4.id, type: 'Revize_hasiciho_pristroje', dueDate: new Date('2027-01-10'), done: false } });

  // --- Repair requests (3, all status Nova for Phase 2) ---
  const rr1 = await prisma.repairRequest.create({
    data: {
      landlordId: landlord.id, unitId: u1.id, tenancyId: t1.id,
      category: 'Voda_a_odpad', description: 'Praskla přívodní hadička k pračce, na podlaze je voda',
      photoUrls: [], status: 'Nova',
    },
  });
  await prisma.message.create({ data: { repairRequestId: rr1.id, from: 'najemnik', text: 'Praskla přívodní hadička k pračce, na podlaze je voda. Prosím o urychlenou opravu.' } });

  const rr2 = await prisma.repairRequest.create({
    data: {
      landlordId: landlord.id, unitId: u3.id, tenancyId: t3.id,
      category: 'Topeni', description: 'Netopí topení v obývacím pokoji — v noci klesá teplota pod 18 °C',
      photoUrls: [], status: 'Nova',
    },
  });
  await prisma.message.create({ data: { repairRequestId: rr2.id, from: 'najemnik', text: 'V obývacím pokoji je zima, topení je studené i na maximální stupeň.' } });

  const rr3 = await prisma.repairRequest.create({
    data: {
      landlordId: landlord.id, unitId: u2.id, tenancyId: t2.id,
      category: 'Zamky_a_klice', description: 'Uvolněná klika u vchodových dveří — klika se protáčí',
      photoUrls: [], status: 'Nova',
    },
  });
  await prisma.message.create({ data: { repairRequestId: rr3.id, from: 'najemnik', text: 'Klika u vchodových dveří se protáčí, nejdou otevřít.' } });

  console.log('✅ Seed complete!');
  console.log(`   Landlord: jan.novak@email.cz / heslo123`);
  console.log(`   Tenants:  petra@email.cz / tereza@email.cz / martin@email.cz (all: heslo123)`);
  console.log(`   4 units (3 Prague, 1 Brno), 3 tenancies (VS 1201, 3304, 8802)`);
  console.log(`   3 months payments, 4 inspections, 3 repair requests (all Nová)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());