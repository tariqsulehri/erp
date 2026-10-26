import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword, PASSWORD_MIN_LENGTH } from '../modules/auth/password.js';

// Creates the first Admin user so someone can sign in and create the other users.
// Usage: INITIAL_ADMIN_EMAIL=... INITIAL_ADMIN_PASSWORD=... [INITIAL_ADMIN_NAME=...] npm run seed:admin (or node dist/scripts/seed-admin.js in the backend image)
// Running it again for the same email does nothing; it never changes an existing user's password.

const prisma = new PrismaClient();

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? '';
  const fullName = process.env.INITIAL_ADMIN_NAME?.trim() || 'System Admin';

  if (!email) throw new Error('Set INITIAL_ADMIN_EMAIL.');
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`Set INITIAL_ADMIN_PASSWORD (at least ${PASSWORD_MIN_LENGTH} characters).`);

  const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`;
  if (existing[0]) {
    console.log(`User ${email} already exists. Nothing changed.`);
    return;
  }

  const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const user = await prisma.$transaction(async transaction => {
    const created = await transaction.user.create({
      data: { email, fullName, passwordHash: await hashPassword(password), role: 'admin', passwordChangedAt: new Date() },
    });
    await transaction.userCompanyAccess.createMany({
      data: companies.map(company => ({ userId: created.id, companyId: company.id, accessLevel: 'ALL_BRANCHES' })),
    });
    return created;
  });

  console.log(`Admin user ${user.email} created with All Branches access to ${companies.length} company(ies).`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
