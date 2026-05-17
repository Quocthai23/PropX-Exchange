const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

async function main() {
  const assets = await prisma.asset.findMany({ include: { category: true } });
  console.log('Assets with Categories:', JSON.stringify(assets, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
