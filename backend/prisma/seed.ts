import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data (order matters for FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.invoiceReminder.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.sOSAlert.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.noticeReadReceipt.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.poll.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.gateLog.deleteMany();
  await prisma.visitorPass.deleteMany();
  await prisma.parcel.deleteMany();
  await prisma.document.deleteMany();
  await prisma.documentFolder.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.building.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.user.deleteMany();
  await prisma.society.deleteMany();

  // Create demo society
  const society = await prisma.society.create({
    data: {
      name: 'Sunrise Apartments',
      slug: 'sunrise-apartments',
      timezone: 'Asia/Kolkata',
    },
  });
  console.log(`  ✓ Society: ${society.name} (${society.slug})`);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@sunrise.com',
      name: 'Admin User',
      passwordHash: adminPassword,
    },
  });

  await prisma.membership.create({
    data: {
      userId: admin.id,
      societyId: society.id,
      role: 'COMMITTEE_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✓ Admin: ${admin.email} (password: admin123)`);

  // Create resident user
  const residentPassword = await bcrypt.hash('resident123', 12);
  const resident = await prisma.user.create({
    data: {
      email: 'resident@sunrise.com',
      name: 'Rahul Sharma',
      passwordHash: residentPassword,
    },
  });
  console.log(`  ✓ Resident: ${resident.email} (password: resident123)`);

  // Create buildings and units
  const buildingA = await prisma.building.create({
    data: {
      societyId: society.id,
      name: 'Tower A',
    },
  });

  const buildingB = await prisma.building.create({
    data: {
      societyId: society.id,
      name: 'Tower B',
    },
  });

  // Create units for Tower A
  const unitA1 = await prisma.unit.create({
    data: {
      societyId: society.id,
      buildingId: buildingA.id,
      unitNumber: 'A-101',
      floor: 1,
      type: 'OWNER_OCCUPIED',
    },
  });

  const unitA2 = await prisma.unit.create({
    data: {
      societyId: society.id,
      buildingId: buildingA.id,
      unitNumber: 'A-102',
      floor: 1,
      type: 'RENTED',
    },
  });

  const unitA3 = await prisma.unit.create({
    data: {
      societyId: society.id,
      buildingId: buildingA.id,
      unitNumber: 'A-201',
      floor: 2,
      type: 'VACANT',
    },
  });

  // Create units for Tower B
  const unitB1 = await prisma.unit.create({
    data: {
      societyId: society.id,
      buildingId: buildingB.id,
      unitNumber: 'B-101',
      floor: 1,
      type: 'OWNER_OCCUPIED',
    },
  });

  const unitB2 = await prisma.unit.create({
    data: {
      societyId: society.id,
      buildingId: buildingB.id,
      unitNumber: 'B-102',
      floor: 1,
      type: 'RENTED',
    },
  });

  // Assign resident to unit A-101
  await prisma.membership.create({
    data: {
      userId: resident.id,
      societyId: society.id,
      unitId: unitA1.id,
      role: 'RESIDENT',
      status: 'ACTIVE',
    },
  });

  // Vendors for the maintenance assignment autocomplete (E.164 mobiles, as the
  // API stores them).
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        societyId: society.id,
        name: 'Sunrise Plumbing',
        phone: '+923001234567',
        email: 'plumbing@sunrise-vendors.com',
      },
    }),
    prisma.vendor.create({
      data: {
        societyId: society.id,
        name: 'Karachi Electric Works',
        phone: '+923214567890',
      },
    }),
  ]);
  console.log(`  ✓ Vendors: ${vendors.map((v) => `${v.name} (${v.phone})`).join(', ')}`);

  // One unpaid demo invoice so the manual payment-proof flow (ADR 008) can be
  // exercised without hand-creating an invoice first. Amounts are paisa.
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);
  const invoice = await prisma.invoice.create({
    data: {
      societyId: society.id,
      unitId: unitA1.id,
      invoiceNumber: 'INV-DEMO-0001',
      title: 'Monthly maintenance dues',
      description: 'Demo invoice for local testing',
      amount: 250000, // Rs 2,500
      dueDate,
      status: 'ISSUED',
    },
  });
  console.log(`  ✓ Invoice: ${invoice.invoiceNumber} (Rs 2,500, due ${dueDate.toDateString()})`);

  console.log(`  ✓ Buildings: ${buildingA.name}, ${buildingB.name}`);
  console.log(`  ✓ Units: ${unitA1.unitNumber}, ${unitA2.unitNumber}, ${unitA3.unitNumber}, ${unitB1.unitNumber}, ${unitB2.unitNumber}`);
  console.log('');
  console.log('✅ Seed completed!');
  console.log('   Admin login:    admin@sunrise.com / admin123');
  console.log('   Resident login: resident@sunrise.com / resident123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
