const prisma = require('../backend/src/config/database.ts').default;
(async () => {
    const ean = '8056157881414';
    const product = await prisma.masterFile.findFirst({ where: { eanGtin: ean }, include: { datiIcecat: true } });
    console.log('MasterFile entry:', product);
    const config = await prisma.configurazioneSistema.findMany({ where: { chiave: { in: ['icecat_username', 'icecat_password'] } } });
    console.log('Icecat config entries:', config);
})();
