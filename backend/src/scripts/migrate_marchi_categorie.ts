import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Script di migrazione: Crea e popola tabelle Marchio e Categoria
 * Migra i dati da stringhe a foreign keys
 */
async function migrateToNormalizedTables() {
    try {
        logger.info('=== INIZIO MIGRAZIONE MARCHI E CATEGORIE ===');

        // 1. Crea tabelle se non esistono (usando SQL raw perché Prisma potrebbe non averle ancora)
        logger.info('Step 1: Creazione tabelle Marchio e Categoria...');
        
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "marchi" (
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                "nome" TEXT NOT NULL UNIQUE,
                "normalizzato" TEXT NOT NULL,
                "attivo" BOOLEAN NOT NULL DEFAULT 1,
                "note" TEXT,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL
            )
        `;

        await prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS "marchi_normalizzato_idx" ON "marchi"("normalizzato")
        `;

        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "categorie" (
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                "nome" TEXT NOT NULL UNIQUE,
                "normalizzato" TEXT NOT NULL,
                "attivo" BOOLEAN NOT NULL DEFAULT 1,
                "note" TEXT,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL
            )
        `;

        await prisma.$executeRaw`
            CREATE INDEX IF NOT EXISTS "categorie_normalizzato_idx" ON "categorie"("normalizzato")
        `;

        logger.info('✓ Tabelle create');

        // 2. Estrai marchi unici da ListinoRaw e DatiIcecat
        logger.info('Step 2: Estrazione marchi unici...');
        
        const rawBrands = await prisma.$queryRaw<Array<{ marca: string }>>`
            SELECT DISTINCT marca FROM listini_raw WHERE marca IS NOT NULL AND marca != ''
            UNION
            SELECT DISTINCT json_extract(specificheTecnicheJson, '$.features[?(@.group_name=="General")].Supplier') as marca
            FROM dati_icecat
            WHERE marca IS NOT NULL
        `;

        const uniqueBrands = new Set<string>();
        rawBrands.forEach(row => {
            if (row.marca) {
                const cleaned = row.marca.trim().toUpperCase();
                if (cleaned) uniqueBrands.add(row.marca.trim());
            }
        });

        logger.info(`Trovati ${uniqueBrands.size} marchi univoci`);

        // 3. Popola tabella Marchi
        logger.info('Step 3: Popolamento tabella Marchi...');
        let brandCount = 0;
        
        for (const brandName of uniqueBrands) {
            const normalizzato = brandName.toUpperCase().trim();
            
            try {
                await prisma.$executeRaw`
                    INSERT OR IGNORE INTO marchi (nome, normalizzato, attivo, updatedAt)
                    VALUES (${brandName}, ${normalizzato}, 1, CURRENT_TIMESTAMP)
                `;
                brandCount++;
            } catch (e) {
                logger.warn(`Errore inserimento marchio ${brandName}:`, e);
            }
        }

        logger.info(`✓ Inseriti ${brandCount} marchi`);

        // 4. Estrai categorie uniche da ListinoRaw
        logger.info('Step 4: Estrazione categorie uniche...');
        
        const rawCategories = await prisma.$queryRaw<Array<{ categoriaFornitore: string }>>`
            SELECT DISTINCT categoriaFornitore FROM listini_raw 
            WHERE categoriaFornitore IS NOT NULL AND categoriaFornitore != ''
        `;

        const uniqueCategories = new Set<string>();
        rawCategories.forEach(row => {
            if (row.categoriaFornitore) {
                uniqueCategories.add(row.categoriaFornitore.trim());
            }
        });

        logger.info(`Trovate ${uniqueCategories.size} categorie univoche`);

        // 5. Popola tabella Categorie
        logger.info('Step 5: Popolamento tabella Categorie...');
        let categoryCount = 0;
        
        for (const categoryName of uniqueCategories) {
            const normalizzato = categoryName.toUpperCase().trim();
            
            try {
                await prisma.$executeRaw`
                    INSERT OR IGNORE INTO categorie (nome, normalizzato, attivo, updatedAt)
                    VALUES (${categoryName}, ${normalizzato}, 1, CURRENT_TIMESTAMP)
                `;
                categoryCount++;
            } catch (e) {
                logger.warn(`Errore inserimento categoria ${categoryName}:`, e);
            }
        }

        logger.info(`✓ Inserite ${categoryCount} categorie`);

        // 6. Aggiungi colonne FK a master_file (se non esistono già)
        logger.info('Step 6: Aggiunta colonne FK a master_file...');
        
        try {
            await prisma.$executeRaw`ALTER TABLE master_file ADD COLUMN marchioId INTEGER`;
        } catch (e) {
            logger.info('Colonna marchioId già esistente');
        }

        try {
            await prisma.$executeRaw`ALTER TABLE master_file ADD COLUMN categoriaId INTEGER`;
        } catch (e) {
            logger.info('Colonna categoriaId già esistente');
        }

        // 7. Crea indici per performance
        try {
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "master_file_marchioId_idx" ON "master_file"("marchioId")`;
            await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "master_file_categoriaId_idx" ON "master_file"("categoriaId")`;
        } catch (e) {
            logger.warn('Indici già esistenti');
        }

        // 8. Migra dati esistenti: collega master_file ai nuovi ID
        logger.info('Step 7: Migrazione dati esistenti in master_file...');
        
        // Get all existing master file records
        const masterRecords = await prisma.$queryRaw<Array<{ id: number, marca: string | null, categoriaEcommerce: string | null }>>`
            SELECT id, marca, categoriaEcommerce FROM master_file
        `;

        let migratedCount = 0;
        
        for (const record of masterRecords) {
            let marchioId: number | null = null;
            let categoriaId: number | null = null;

            // Find marchio ID
            if (record.marca) {
                const normalizzato = record.marca.toUpperCase().trim();
                const marchio = await prisma.$queryRaw<Array<{ id: number }>>`
                    SELECT id FROM marchi WHERE normalizzato = ${normalizzato} LIMIT 1
                `;
                if (marchio.length > 0) {
                    marchioId = marchio[0].id;
                }
            }

            // Find categoria ID
            if (record.categoriaEcommerce) {
                const normalizzato = record.categoriaEcommerce.toUpperCase().trim();
                const categoria = await prisma.$queryRaw<Array<{ id: number }>>`
                    SELECT id FROM categorie WHERE normalizzato = ${normalizzato} LIMIT 1
                `;
                if (categoria.length > 0) {
                    categoriaId = categoria[0].id;
                }
            }

            // Update master file record
            if (marchioId || categoriaId) {
                await prisma.$executeRaw`
                    UPDATE master_file 
                    SET marchioId = ${marchioId}, categoriaId = ${categoriaId}
                    WHERE id = ${record.id}
                `;
                migratedCount++;
            }
        }

        logger.info(`✓ Migrati ${migratedCount} record in master_file`);

        // 9. Aggiungi colonne FK a regole_markup
        logger.info('Step 8: Aggiunta colonne FK a regole_markup...');
        
        try {
            await prisma.$executeRaw`ALTER TABLE regole_markup ADD COLUMN marchioId INTEGER`;
        } catch (e) {
            logger.info('Colonna marchioId già esistente in regole_markup');
        }

        try {
            await prisma.$executeRaw`ALTER TABLE regole_markup ADD COLUMN categoriaId INTEGER`;
        } catch (e) {
            logger.info('Colonna categoriaId già esistente in regole_markup');
        }

        // 10. Migra filtri esistenti
        logger.info('Step 9: Migrazione filtri esistenti...');
        
        const filters = await prisma.$queryRaw<Array<{ id: number, brand: string | null, categoria: string | null }>>`
            SELECT id, brand, categoria FROM product_filter_rules
        `;

        // Add FK columns to filter rules
        try {
            await prisma.$executeRaw`ALTER TABLE product_filter_rules ADD COLUMN marchioId INTEGER`;
        } catch (e) {
            logger.info('Colonna marchioId già esistente in filter_rules');
        }

        try {
            await prisma.$executeRaw`ALTER TABLE product_filter_rules ADD COLUMN categoriaId INTEGER`;
        } catch (e) {
            logger.info('Colonna categoriaId già esistente in filter_rules');
        }

        for (const filter of filters) {
            let marchioId: number | null = null;
            let categoriaId: number | null = null;

            if (filter.brand) {
                const normalizzato = filter.brand.toUpperCase().trim();
                const marchio = await prisma.$queryRaw<Array<{ id: number }>>`
                    SELECT id FROM marchi WHERE normalizzato = ${normalizzato} LIMIT 1
                `;
                if (marchio.length > 0) {
                    marchioId = marchio[0].id;
                }
            }

            if (filter.categoria) {
                const normalizzato = filter.categoria.toUpperCase().trim();
                const categoria = await prisma.$queryRaw<Array<{ id: number }>>`
                    SELECT id FROM categorie WHERE normalizzato = ${normalizzato} LIMIT 1
                `;
                if (categoria.length > 0) {
                    categoriaId = categoria[0].id;
                }
            }

            if (marchioId || categoriaId) {
                await prisma.$executeRaw`
                    UPDATE product_filter_rules 
                    SET marchioId = ${marchioId}, categoriaId = ${categoriaId}
                    WHERE id = ${filter.id}
                `;
            }
        }

        logger.info(`✓ Migrati ${filters.length} filtri`);

        logger.info('=== MIGRAZIONE COMPLETATA CON SUCCESSO ===');
        logger.info(`Riepilogo:`);
        logger.info(`- Marchi inseriti: ${brandCount}`);
        logger.info(`- Categorie inserite: ${categoryCount}`);
        logger.info(`- Record master_file aggiornati: ${migratedCount}`);
        logger.info(`- Filtri migrati: ${filters.length}`);

    } catch (error) {
        logger.error('Errore durante la migrazione:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the migration
migrateToNormalizedTables()
    .then(() => {
        console.log('Script completato');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script fallito:', error);
        process.exit(1);
    });
