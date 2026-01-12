
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- FORNITORI ---');
  const fornitori = await prisma.fornitore.findMany();
  console.table(fornitori);

  console.log('\n--- REGOLE FILTRO ---');
  const regole = await prisma.productFilterRule.findMany();
  console.table(regole);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
