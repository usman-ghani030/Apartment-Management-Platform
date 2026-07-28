import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.building.deleteMany();
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
