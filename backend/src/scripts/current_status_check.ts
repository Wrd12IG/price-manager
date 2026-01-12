import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
  try {
    const totalOutput = await prisma.outputShopify.count();
    const pending = await prisma.outputShopify.count({ where: { statoCaricamento: 'pending' } });
    const uploaded = await prisma.outputShopify.count({ where: { statoCaricamento: 'uploaded' } });
    const error = await prisma.outputShopify.count({ where: { statoCaricamento: 'error' } });
    
    console.log('--- Shopify Output Status ---');
    console.log(`Total records: ${totalOutput}`);
    console.log(`Pending: ${pending}`);
    console.log(`Uploaded/Synced: ${uploaded}`);
    console.log(`Errors: ${error}`);
    
    if (error > 0) {
      const errorDetails = await prisma.outputShopify.findMany({
        where: { statoCaricamento: 'error' },
        take: 5,
        select: { handle: true, errorMessage: true }
      });
      console.log('\n--- Recent Errors ---');
      errorDetails.forEach(e => console.log(`${e.handle}: ${e.errorMessage}`));
    }

    const latest = await prisma.outputShopify.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true, handle: true, statoCaricamento: true }
    });

    if (latest) {
      console.log(`\nLast update: ${latest.updatedAt} (Product: ${latest.handle}, Status: ${latest.statoCaricamento})`);
    }

  } catch (err) {
    console.error('Error checking status:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
