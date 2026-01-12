import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed delle regole di filtro prodotti predefinite
 * Basato sui requisiti dell'utente per filtrare prodotti ASUS e categorie specifiche
 */
async function seedFilterRules() {
  console.log('🌱 Seeding Product Filter Rules...');

  // Elimina regole esistenti per evitare duplicati
  await prisma.productFilterRule.deleteMany();
  await prisma.filterPreset.deleteMany();

  // ============================================
  // REGOLE INDIVIDUALI
  // ============================================

  const rules = [
    // 1. TUTTI I PRODOTTI ASUS E ASUSTEK
    {
      nome: 'Tutti i prodotti ASUS',
      tipoFiltro: 'brand',
      brand: 'ASUS',
      categoria: null,
      azione: 'include',
      priorita: 1,
      attiva: true,
      note: 'Include tutti i prodotti del brand ASUS (Monitor, Notebook, tastiere, mouse, borse, accessori, tappetini, ecc.)'
    },
    {
      nome: 'Tutti i prodotti ASUSTEK',
      tipoFiltro: 'brand',
      brand: 'ASUSTEK',
      categoria: null,
      azione: 'include',
      priorita: 1,
      attiva: true,
      note: 'Include tutti i prodotti del brand ASUSTEK'
    },

    // 2. RAM - TUTTI I BRAND
    {
      nome: 'RAM - Tutti i brand',
      tipoFiltro: 'category',
      brand: null,
      categoria: 'RAM',
      azione: 'include',
      priorita: 2,
      attiva: true,
      note: 'Include tutte le memorie RAM indipendentemente dal brand'
    },

    // 3. CPU - TUTTI I BRAND
    {
      nome: 'CPU - Tutti i brand',
      tipoFiltro: 'category',
      brand: null,
      categoria: 'CPU',
      azione: 'include',
      priorita: 2,
      attiva: true,
      note: 'Include tutti i processori indipendentemente dal brand'
    },
    {
      nome: 'Processori - Tutti i brand',
      tipoFiltro: 'category',
      brand: null,
      categoria: 'Processori',
      azione: 'include',
      priorita: 2,
      attiva: true,
      note: 'Include tutti i processori (nome alternativo categoria)'
    },

    // 4. ALIMENTATORI - SOLO ASUS E ASUSTEK
    {
      nome: 'Alimentatori ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Alimentatori',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo alimentatori ASUS'
    },
    {
      nome: 'Alimentatori ASUSTEK',
      tipoFiltro: 'brand_category',
      brand: 'ASUSTEK',
      categoria: 'Alimentatori',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo alimentatori ASUSTEK'
    },

    // 5. MOTHERBOARD - SOLO ASUS E ASUSTEK
    {
      nome: 'Motherboard ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Motherboard',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo schede madri ASUS'
    },
    {
      nome: 'Motherboard ASUSTEK',
      tipoFiltro: 'brand_category',
      brand: 'ASUSTEK',
      categoria: 'Motherboard',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo schede madri ASUSTEK'
    },
    {
      nome: 'Schede Madri ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Schede Madri',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo schede madri ASUS (nome alternativo)'
    },

    // 6. SCHEDE VIDEO - SOLO ASUS E ASUSTEK
    {
      nome: 'Schede Video ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Schede Video',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo schede video ASUS'
    },
    {
      nome: 'Schede Video ASUSTEK',
      tipoFiltro: 'brand_category',
      brand: 'ASUSTEK',
      categoria: 'Schede Video',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo schede video ASUSTEK'
    },
    {
      nome: 'GPU ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'GPU',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo GPU ASUS (nome alternativo)'
    },

    // 7. DISSIPATORI - SOLO ASUS E ASUSTEK
    {
      nome: 'Dissipatori ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Dissipatori',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo dissipatori ASUS'
    },
    {
      nome: 'Dissipatori ASUSTEK',
      tipoFiltro: 'brand_category',
      brand: 'ASUSTEK',
      categoria: 'Dissipatori',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo dissipatori ASUSTEK'
    },
    {
      nome: 'Cooler ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Cooler',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo cooler ASUS (nome alternativo)'
    },

    // 8. CASE - SOLO ASUS E ASUSTEK
    {
      nome: 'Case ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Case',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo case ASUS'
    },
    {
      nome: 'Case ASUSTEK',
      tipoFiltro: 'brand_category',
      brand: 'ASUSTEK',
      categoria: 'Case',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo case ASUSTEK'
    },

    // 9. GAMING CHAIR - TUTTI I BRAND
    {
      nome: 'Gaming Chair - Tutti i brand',
      tipoFiltro: 'category',
      brand: null,
      categoria: 'Gaming Chair',
      azione: 'include',
      priorita: 2,
      attiva: true,
      note: 'Include tutte le sedie gaming indipendentemente dal brand'
    },
    {
      nome: 'Sedie Gaming - Tutti i brand',
      tipoFiltro: 'category',
      brand: null,
      categoria: 'Sedie Gaming',
      azione: 'include',
      priorita: 2,
      attiva: true,
      note: 'Include tutte le sedie gaming (nome alternativo)'
    },

    // 10. ESTENSIONI GARANZIA - SOLO ASUS
    {
      nome: 'Estensioni Garanzia ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Garanzia',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo estensioni di garanzia ASUS'
    },
    {
      nome: 'Warranty Extension ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Warranty',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo estensioni di garanzia ASUS (nome alternativo)'
    },

    // 11. LICENZE WINDOWS - TUTTI I BRAND
    {
      nome: 'Licenze Windows',
      tipoFiltro: 'category',
      brand: null,
      categoria: 'Licenze Windows',
      azione: 'include',
      priorita: 2,
      attiva: true,
      note: 'Include tutte le licenze Windows'
    },
    {
      nome: 'Software Windows',
      tipoFiltro: 'category',
      brand: null,
      categoria: 'Software',
      azione: 'include',
      priorita: 2,
      attiva: true,
      note: 'Include software e licenze'
    },

    // 12. PC DESKTOP - SOLO ASUS
    {
      nome: 'PC Desktop ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'PC Desktop',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo PC desktop ASUS'
    },
    {
      nome: 'Desktop ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Desktop',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo desktop ASUS (nome alternativo)'
    },

    // 13. ALL IN ONE - SOLO ASUS
    {
      nome: 'All in One ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'All in One',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo All in One ASUS'
    },
    {
      nome: 'AIO ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'AIO',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo AIO ASUS (nome alternativo)'
    },

    // 14. CUFFIE - SOLO ASUS E ASUSTEK
    {
      nome: 'Cuffie ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Cuffie',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo cuffie ASUS'
    },
    {
      nome: 'Cuffie ASUSTEK',
      tipoFiltro: 'brand_category',
      brand: 'ASUSTEK',
      categoria: 'Cuffie',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo cuffie ASUSTEK'
    },
    {
      nome: 'Headset ASUS',
      tipoFiltro: 'brand_category',
      brand: 'ASUS',
      categoria: 'Headset',
      azione: 'include',
      priorita: 3,
      attiva: true,
      note: 'Include solo headset ASUS (nome alternativo)'
    },
  ];

  // Inserisci le regole
  for (const rule of rules) {
    await prisma.productFilterRule.create({
      data: rule
    });
  }

  console.log(`✅ Create ${rules.length} regole di filtro`);

  // ============================================
  // PRESET PREDEFINITO
  // ============================================

  const presetAsus = await prisma.filterPreset.create({
    data: {
      nome: 'ASUS & Componenti PC',
      descrizione: 'Configurazione completa per prodotti ASUS/ASUSTEK e componenti PC selezionati',
      regoleJson: JSON.stringify({
        brands: ['ASUS', 'ASUSTEK'],
        categories: {
          all_brands: ['RAM', 'CPU', 'Processori', 'Gaming Chair', 'Sedie Gaming', 'Licenze Windows', 'Software'],
          asus_only: [
            'Alimentatori', 'Motherboard', 'Schede Madri', 'Schede Video', 'GPU',
            'Dissipatori', 'Cooler', 'Case', 'Garanzia', 'Warranty',
            'PC Desktop', 'Desktop', 'All in One', 'AIO', 'Cuffie', 'Headset'
          ]
        },
        note: 'Tutti i prodotti ASUS/ASUSTEK + categorie specifiche di tutti i brand'
      }),
      attivo: true
    }
  });

  console.log(`✅ Creato preset: ${presetAsus.nome}`);

  console.log('\n🎉 Seed completato con successo!');
  console.log('\n📋 Riepilogo regole create:');
  console.log('   - Tutti i prodotti ASUS e ASUSTEK');
  console.log('   - RAM (tutti i brand)');
  console.log('   - CPU (tutti i brand)');
  console.log('   - Alimentatori (solo ASUS/ASUSTEK)');
  console.log('   - Motherboard (solo ASUS/ASUSTEK)');
  console.log('   - Schede Video (solo ASUS/ASUSTEK)');
  console.log('   - Dissipatori (solo ASUS/ASUSTEK)');
  console.log('   - Case (solo ASUS/ASUSTEK)');
  console.log('   - Gaming Chair (tutti i brand)');
  console.log('   - Estensioni Garanzia (solo ASUS)');
  console.log('   - Licenze Windows (tutti i brand)');
  console.log('   - PC Desktop (solo ASUS)');
  console.log('   - All in One (solo ASUS)');
  console.log('   - Cuffie (solo ASUS/ASUSTEK)');
}

seedFilterRules()
  .catch((e) => {
    console.error('❌ Errore durante il seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
