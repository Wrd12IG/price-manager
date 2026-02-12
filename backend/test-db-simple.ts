import { PrismaClient } from '@prisma/client';

async function main() {
  const url = "postgresql://postgres.apafzmiuvffewljfgfro:VWzy7uufEmv4fq3Y@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
  console.log('Testing Production URL');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url
      }
    }
  });

  try {
    await prisma.$connect();
    console.log('✅ Connected!');
    const count = await prisma.masterFile.count();
    console.log('MasterFile count:', count);

    const targetPartNumbers = [
      'S5606CA-RI068W',
      'FA808UP-S9023W',
      'B3605CCA-MB0062X',
      'P1403CVA-S61680X'
    ];

    for (const pn of targetPartNumbers) {
      const product = await prisma.masterFile.findFirst({
        where: { partNumber: { contains: pn, mode: 'insensitive' } },
        include: { outputShopify: true, datiIcecat: true }
      });
      if (product) {
        console.log(`\n📦 Product: ${pn}`);
        console.log(`   Has Icecat: ${!!product.datiIcecat}`);
        console.log(`   Has OutputShopify: ${!!product.outputShopify}`);
        if (product.outputShopify) {
          const mf = JSON.parse(product.outputShopify.metafieldsJson || '{}');
          console.log(`   Has Specs Table: ${!!mf['custom.tabella_specifiche']}`);
        }
      } else {
        console.log(`\n❌ Product not found: ${pn}`);
      }
    }

  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
