const { PrismaClient } = require('@prisma/client');
async function test() {
  const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://pricemanager:O5FhD4R2u2I2aJpA0GkB@localhost:5432/pricemanager' } } });
  try {
    const utenti = await prisma.utente.findMany();
    console.log('✅ OK - Trovi:', utenti.map(u => u.email));
  } catch (e) {
    console.error('❌ ERRORE', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
