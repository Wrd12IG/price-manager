import prisma from './src/config/database.js';

async function checkProduct() {
  const product = await prisma.masterFile.findFirst({
    where: {
      OR: [
        { nomeProdotto: { contains: 'G615', mode: 'insensitive' } },
        { nomeProdotto: { contains: 'Strix G16', mode: 'insensitive' } },
        { nomeProdotto: { contains: 'i7-14650HX', mode: 'insensitive' } },
        { nomeProdotto: { contains: 'RTX 4060', mode: 'insensitive' } }
      ]
    },
    include: {
      marchio: true,
      categoria: true,
      outputShopify: true,
      datiIcecat: true
    }
  });

  if (!product) {
    console.log('❌ Prodotto non trovato');
    const allAsus = await prisma.masterFile.findMany({
      where: {
        marchio: { nome: { contains: 'ASUS', mode: 'insensitive' } }
      },
      take: 5,
      select: {
        nomeProdotto: true,
        eanGtin: true
      }
    });
    console.log('\nProdotti ASUS trovati:');
    allAsus.forEach(p => console.log('-', p.nomeProdotto));
    await prisma.$disconnect();
    return;
  }

  console.log('\n📦 PRODOTTO TROVATO:');
  console.log('Nome:', product.nomeProdotto);
  console.log('EAN:', product.eanGtin);
  console.log('Marca:', product.marchio?.nome);
  
  console.log('\n📊 DATI ICECAT:');
  console.log('Ha dati Icecat:', !!product.datiIcecat);
  if (product.datiIcecat) {
    console.log('Descrizione breve:', product.datiIcecat.descrizioneBrave?.substring(0, 100));
    console.log('Ha specifiche:', !!product.datiIcecat.specificheTecnicheJson);
    if (product.datiIcecat.specificheTecnicheJson) {
      const specs = JSON.parse(product.datiIcecat.specificheTecnicheJson);
      console.log('Numero specifiche:', Array.isArray(specs) ? specs.length : Object.keys(specs).length);
    }
  }
  
  console.log('\n🏪 OUTPUT SHOPIFY:');
  console.log('Ha record OutputShopify:', !!product.outputShopify);
  if (product.outputShopify) {
    console.log('Stato:', product.outputShopify.statoCaricamento);
    console.log('\n🏷️  METAFIELDS GENERATI:');
    if (product.outputShopify.metafieldsJson) {
      const meta = JSON.parse(product.outputShopify.metafieldsJson);
      const keys = Object.keys(meta);
      console.log('Numero metafields:', keys.length);
      console.log('\nMetafields disponibili:');
      keys.forEach(key => {
        const value = meta[key];
        const preview = value.length > 60 ? value.substring(0, 60) + '...' : value;
        console.log(`  - ${key}: ${preview}`);
      });
    } else {
      console.log('⚠️  Nessun metafield generato!');
    }
  }
  
  await prisma.$disconnect();
}

checkProduct();
