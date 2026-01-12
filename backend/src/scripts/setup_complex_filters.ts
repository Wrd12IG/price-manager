
import prisma from '../config/database';

async function setupFilters() {
    console.log('🔧 CONFIGURAZIONE FILTRI COMPLESSI\n');

    try {
        // 1. Disattiva tutte le regole esistenti
        console.log('1️⃣  Disattivazione regole esistenti...');
        await prisma.productFilterRule.updateMany({
            data: { attiva: false }
        });
        console.log('   ✅ Regole precedenti disattivate');

        // 2. Definizione Nuove Regole
        // 2. Definizione Nuove Regole (con sinonimi IT/EN)
        const rules = [
            // --- REGOLE SOLO ASUS/ASUSTEK ---
            // Monitor
            { nome: 'Asus Monitor EN', tipo: 'brand_category', brand: 'ASUS', cat: 'MONITOR' },
            { nome: 'Asus Monitor IT', tipo: 'brand_category', brand: 'ASUS', cat: 'SCHERM' },
            // Notebook
            { nome: 'Asus Notebook', tipo: 'brand_category', brand: 'ASUS', cat: 'NOTEBOOK' },
            { nome: 'Asus Laptop', tipo: 'brand_category', brand: 'ASUS', cat: 'LAPTOP' },
            { nome: 'Asus Portatili', tipo: 'brand_category', brand: 'ASUS', cat: 'PORTATIL' },
            // Tastiere
            { nome: 'Asus Keyboard', tipo: 'brand_category', brand: 'ASUS', cat: 'KEYBOARD' },
            { nome: 'Asus Tastiera', tipo: 'brand_category', brand: 'ASUS', cat: 'TASTIER' },
            // Mouse
            { nome: 'Asus Mouse', tipo: 'brand_category', brand: 'ASUS', cat: 'MOUSE' },
            // Borse
            { nome: 'Asus Bag', tipo: 'brand_category', brand: 'ASUS', cat: 'BAG' },
            { nome: 'Asus Borsa', tipo: 'brand_category', brand: 'ASUS', cat: 'BORS' },
            { nome: 'Asus Zaino', tipo: 'brand_category', brand: 'ASUS', cat: 'ZAIN' },
            // Accessori
            { nome: 'Asus Accessori', tipo: 'brand_category', brand: 'ASUS', cat: 'ACCESSOR' },
            // Tappetini
            { nome: 'Asus Mousepad', tipo: 'brand_category', brand: 'ASUS', cat: 'MOUSEPAD' },
            { nome: 'Asus Tappetino', tipo: 'brand_category', brand: 'ASUS', cat: 'TAPPETIN' },
            // Alimentatori
            { nome: 'Asus Power', tipo: 'brand_category', brand: 'ASUS', cat: 'POWER' },
            { nome: 'Asus Alimentatore', tipo: 'brand_category', brand: 'ASUS', cat: 'ALIMENTATOR' },
            // Motherboard
            { nome: 'Asus Motherboard', tipo: 'brand_category', brand: 'ASUS', cat: 'MOTHERBOARD' },
            { nome: 'Asus Scheda Madre', tipo: 'brand_category', brand: 'ASUS', cat: 'SCHEDA MADRE' },
            { nome: 'Asus Mainboard', tipo: 'brand_category', brand: 'ASUS', cat: 'MAINBOARD' },
            // Schede Video
            { nome: 'Asus Video', tipo: 'brand_category', brand: 'ASUS', cat: 'VIDEO' },
            { nome: 'Asus VGA', tipo: 'brand_category', brand: 'ASUS', cat: 'VGA' },
            { nome: 'Asus GPU', tipo: 'brand_category', brand: 'ASUS', cat: 'SCHEDA GRAFICA' },
            // Dissipatori
            { nome: 'Asus Cooler', tipo: 'brand_category', brand: 'ASUS', cat: 'COOLER' },
            { nome: 'Asus Dissipatore', tipo: 'brand_category', brand: 'ASUS', cat: 'DISSIPATOR' },
            { nome: 'Asus Ventola', tipo: 'brand_category', brand: 'ASUS', cat: 'VENTOL' },
            // Case
            { nome: 'Asus Case', tipo: 'brand_category', brand: 'ASUS', cat: 'CASE' },
            { nome: 'Asus Chassis', tipo: 'brand_category', brand: 'ASUS', cat: 'CHASSIS' },
            { nome: 'Asus Cabinet', tipo: 'brand_category', brand: 'ASUS', cat: 'CABINET' },
            // Garanzia
            { nome: 'Asus Warranty', tipo: 'brand_category', brand: 'ASUS', cat: 'WARRANTY' },
            { nome: 'Asus Garanzia', tipo: 'brand_category', brand: 'ASUS', cat: 'GARANZI' },
            // Desktop
            { nome: 'Asus Desktop', tipo: 'brand_category', brand: 'ASUS', cat: 'DESKTOP' },
            { nome: 'Asus PC Fisso', tipo: 'brand_category', brand: 'ASUS', cat: 'PC' }, // Rischioso, ma ok se combinato con brand
            // AIO
            { nome: 'Asus AIO', tipo: 'brand_category', brand: 'ASUS', cat: 'ALL-IN-ONE' },
            { nome: 'Asus Tutto in uno', tipo: 'brand_category', brand: 'ASUS', cat: 'ALL IN ONE' },
            // Cuffie
            { nome: 'Asus Headset', tipo: 'brand_category', brand: 'ASUS', cat: 'HEAD' },
            { nome: 'Asus Cuffie', tipo: 'brand_category', brand: 'ASUS', cat: 'CUFFI' },

            // --- REGOLE TUTTE LE MARCHE ---
            // RAM
            { nome: 'Tutte RAM', tipo: 'category', brand: null, cat: 'RAM' },
            { nome: 'Tutte Memory', tipo: 'category', brand: null, cat: 'MEMORY' },
            { nome: 'Tutte Memoria', tipo: 'category', brand: null, cat: 'MEMORIA' },
            // CPU
            { nome: 'Tutte CPU', tipo: 'category', brand: null, cat: 'CPU' },
            { nome: 'Tutte Processor', tipo: 'category', brand: null, cat: 'PROCESSOR' },
            { nome: 'Tutte Processore', tipo: 'category', brand: null, cat: 'PROCESSORE' },
            // Gaming Chair
            { nome: 'Tutte Chair', tipo: 'category', brand: null, cat: 'CHAIR' },
            { nome: 'Tutte Sedia', tipo: 'category', brand: null, cat: 'SEDIA' },
            { nome: 'Tutte Poltrona', tipo: 'category', brand: null, cat: 'POLTRONA' },
            // Windows
            { nome: 'Tutte Windows', tipo: 'category', brand: null, cat: 'WINDOWS' },
            { nome: 'Tutte Licenza', tipo: 'category', brand: null, cat: 'LICENZ' },
        ];

        // 3. Creazione Regole nel DB
        console.log('\n2️⃣  Creazione nuove regole...');
        for (const r of rules) {
            // Per ASUS, creiamo regole anche per ASUSTEK se necessario, 
            // ma il filtro brand spesso normalizza. Creiamo regole separate per sicurezza se il tipo è brand_category.

            if (r.tipo === 'brand_category') {
                // Regola per ASUS
                await prisma.productFilterRule.create({
                    data: {
                        nome: r.nome,
                        tipoFiltro: 'brand_category',
                        brand: 'ASUS',
                        categoria: r.cat,
                        azione: 'include',
                        attiva: true
                    }
                });

                // Regola per ASUSTEK (duplicata per sicurezza)
                await prisma.productFilterRule.create({
                    data: {
                        nome: r.nome.replace('Asus', 'Asustek'),
                        tipoFiltro: 'brand_category',
                        brand: 'ASUSTEK',
                        categoria: r.cat,
                        azione: 'include',
                        attiva: true
                    }
                });
            } else {
                // Regola solo categoria (Tutte le marche)
                await prisma.productFilterRule.create({
                    data: {
                        nome: r.nome,
                        tipoFiltro: 'category',
                        categoria: r.cat,
                        azione: 'include',
                        attiva: true
                    }
                });
            }
        }
        console.log(`   ✅ Create ${rules.length * (rules[0].brand ? 2 : 1)} regole (approx)`);

        // 4. Verifica conteggi
        console.log('\n3️⃣  Verifica Prodotti Inclusi...');
        // Simuliamo un controllo rapido
        const total = await prisma.masterFile.count();
        console.log(`   Totale prodotti nel DB: ${total}`);

        // Nota: Il conteggio reale richiede l'esecuzione di ProductFilterService.evaluateRules() su tutti i prodotti.
        // Lo faremo nel prossimo step lanciando il ricalcolo.

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setupFilters();
