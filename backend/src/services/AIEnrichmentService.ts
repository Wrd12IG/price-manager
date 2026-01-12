import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { WebScrapingEnrichmentService } from './WebScrapingEnrichmentService';
import { AITitleService } from './AITitleService';

const prisma = new PrismaClient();

export class AIEnrichmentService {

    /**
     * Genera contenuto completo per un prodotto usando dati locali (NO API ESTERNE)
     */
    static async generateProductContent(masterFileId: number) {
        // 1. Recupera TUTTI i dati del prodotto
        const product = await prisma.masterFile.findUnique({
            where: { id: masterFileId },
            include: {
                datiIcecat: true,
                fornitoreSelezionato: true,
                marchio: true,
                categoria: true
            }
        });

        if (!product) throw new Error(`Prodotto ID ${masterFileId} non trovato`);

        // --- 0. ARRICCHIMENTO ON-DEMAND (WEB SCRAPING) ---
        // Se non abbiamo dati icecat, proviamo a cercarli sul web
        if (!product.datiIcecat) {
            logger.info(`🌐 Dati Icecat mancanti per ${product.eanGtin}, avvio Web Scraping...`);
            await WebScrapingEnrichmentService.enrichSingleProduct(product.id);

            // Ricarica il prodotto aggiornato
            const upgradedProduct = await prisma.masterFile.findUnique({
                where: { id: masterFileId },
                include: {
                    datiIcecat: true,
                    fornitoreSelezionato: true,
                    marchio: true,
                    categoria: true
                }
            });

            if (upgradedProduct) {
                // Aggiorna il riferimento locale
                Object.assign(product, upgradedProduct);
            }
        }

        const icecat = product.datiIcecat;

        // --- FILTRO QUALITÀ: Salta prodotti senza dati minimi ---
        // Richiediamo almeno UNO di questi:
        // - Descrizione Icecat (breve o lunga)
        // - Nome prodotto valido (non generico, non codice)
        const hasIcecatDescription = icecat?.descrizioneBrave || icecat?.descrizioneLunga;
        const hasValidProductName = product.nomeProdotto &&
            product.nomeProdotto.length > 5 &&
            !/^[0-9\.\-\s]+$/.test(product.nomeProdotto) &&
            !product.nomeProdotto.toLowerCase().includes('senza nome');

        if (!hasIcecatDescription && !hasValidProductName) {
            logger.warn(`⚠️  Saltato prodotto ID ${masterFileId}: dati insufficienti (no Icecat, no nome valido)`);
            return false; // Salta questo prodotto
        }

        // Parsing sicuro delle features
        let features: any[] = [];
        try {
            if (icecat?.specificheTecnicheJson) {
                const parsed = JSON.parse(icecat.specificheTecnicheJson);
                if (Array.isArray(parsed)) {
                    features = parsed;
                } else if (parsed && Array.isArray(parsed.features)) {
                    features = parsed.features;
                } else {
                    features = [];
                }
            }
        } catch (e) {
            features = [];
        }

        const bullets = icecat?.bulletPointsJson ? JSON.parse(icecat.bulletPointsJson) : [];

        // --- GENERAZIONE LOCALE ---

        // 1. Genera Titolo SEO
        // Estrai la marca: prima dal MasterFile, poi dalla descrizione Icecat, infine dal fornitore
        let brand = product.marchio?.nome;

        if (!brand && icecat?.descrizioneBrave) {
            // Estrai la prima parola dalla descrizione Icecat (di solito è la marca)
            const firstWord = icecat.descrizioneBrave.split(' ')[0];
            // Verifica che sia una marca valida (non un numero o codice)
            if (firstWord && !/^[0-9\.\-]+$/.test(firstWord) && firstWord.length > 2) {
                brand = firstWord;
            }
        }

        // Fallback al fornitore solo se proprio non c'è nulla
        if (!brand) {
            brand = product.fornitoreSelezionato?.nomeFornitore || 'Generico';
        }

        // Normalizzazione Brand (es. ASUSTEK -> ASUS)
        if (brand?.toUpperCase() === 'ASUSTEK') brand = 'ASUS';
        if (brand?.toUpperCase() === 'HP INC') brand = 'HP';
        if (brand?.toUpperCase() === 'LENOVO GROUP') brand = 'Lenovo';

        const model = product.nomeProdotto || product.skuSelezionato;
        const category = product.categoria?.nome || 'Hardware';

        // Genera titolo usando AITitleService per massima qualità
        // Passiamo descrizione e features per aiutare l'AI
        const aiTitle = await AITitleService.generateProductTitle(
            product.eanGtin,
            brand,
            category,
            product.nomeProdotto || undefined,
            icecat?.descrizioneBrave || icecat?.descrizioneLunga || undefined,
            icecat?.specificheTecnicheJson || features
        );

        let title = aiTitle;

        // Fallback locale se AITitleService fallisce (ritorna null o titolo brutto)
        // Nota: generateProductTitle ha già un fallback interno, ma per sicurezza...
        if (!title || title.includes('Prodotto Professionale')) {
            title = this.generateOptimizedTitle(brand, model, category, features, icecat?.descrizioneBrave || '');
        }

        // 2. Genera Descrizione HTML (Stile Minimale & Elegante)
        let introText = '';
        if (icecat?.descrizioneLunga) {
            // Se la descrizione è già stata processata/avvolta (es. da un run precedente), usala così com'è
            if (icecat.descrizioneLunga.includes('class="product-description"') ||
                icecat.descrizioneLunga.includes('class="marketing-intro"')) {
                return true;
            }

            // Altrimenti usa descrizione Icecat pulendo eventuali nomi brand brutti
            introText = icecat.descrizioneLunga
                .replace(/ASUSTeK/g, 'ASUS')
                .replace(/ASUSTEK/g, 'ASUS');
        } else {
            // Fallback generato: Più marketing e attraente
            const categoryName = category !== 'Hardware' ? category : 'prodotto';
            introText = `Scopri l'eccellenza e l'affidabilità di <strong>${brand}</strong> con questo nuovissimo ${categoryName.toLowerCase()}. 
            Progettato per soddisfare le esigenze di chi cerca prestazioni superiori e design all'avanguardia, questo dispositivo è la soluzione ideale per professionisti, studenti e appassionati di tecnologia.
            Grazie all'integrazione delle più recenti tecnologie hardware, offre un'esperienza d'uso fluida, veloce e senza compromessi, perfetta sia per la produttività lavorativa che per l'intrattenimento multimediale.`;
        }

        let bodyHtml = `<div class="product-description" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 100%; margin: 0 auto;">`;

        bodyHtml += `<div class="marketing-intro" style="margin-bottom: 30px;">
            <p style="font-size: 16px; line-height: 1.8; color: #333; margin: 0;">${introText}</p>
        </div>`;

        // Bullet Points (Vantaggi)
        if (bullets.length > 0) {
            bodyHtml += `<div class="features-section" style="margin: 30px 0;">
                <h3 style="font-size: 18px; font-weight: 600; color: #111; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">Caratteristiche Principali</h3>
                <ul style="list-style-type: disc; padding-left: 20px; color: #444;">`;
            bullets.forEach((b: string) => bodyHtml += `<li style="margin-bottom: 8px; line-height: 1.6;">${b}</li>`);
            bodyHtml += `</ul></div>`;
        }

        // Tabella Specifiche (Solo se ci sono dati)
        if (features.length > 0) {
            bodyHtml += `<div class="specs-section" style="margin: 30px 0;">
                <h3 style="font-size: 18px; font-weight: 600; color: #111; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">Specifiche Tecniche</h3>
                <table class="specs-table" style="width:100%; border-collapse: collapse; font-size: 14px;"><tbody>`;

            features.slice(0, 15).forEach((f: any) => {
                if (f.name && f.value) {
                    bodyHtml += `<tr style="border-bottom: 1px solid #f0f0f0;">
                        <td style="padding: 10px 0; font-weight: 600; color: #555; width: 30%;">${f.name}</td>
                        <td style="padding: 10px 0; color: #333;">${f.value}</td>
                    </tr>`;
                }
            });
            bodyHtml += `</tbody></table></div>`;
        }

        // Garanzia (Footer)
        bodyHtml += `<div class="guarantee-section" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 13px; color: #666;">
            <p style="margin: 0;">Garanzia Ufficiale &bull; Spedizione Assicurata &bull; Assistenza Clienti</p>
        </div>`;

        bodyHtml += `</div>`;

        // 3. Genera Tags
        const tags = [brand, category, 'Nuovo', 'Spedizione Rapida'];
        if (features.length > 0) tags.push('Specifiche Complete');

        // 4. Salva in OutputShopify
        await prisma.outputShopify.upsert({
            where: { masterFileId: product.id },
            create: {
                masterFileId: product.id,
                handle: this.generateHandle(title, product.id),
                title: title,
                bodyHtml: bodyHtml,
                vendor: brand,
                productType: category,
                tags: tags.join(', '),
                variantPrice: product.prezzoVenditaCalcolato || product.prezzoAcquistoMigliore,
                variantInventoryQty: product.quantitaTotaleAggregata,
                immaginiUrls: icecat?.urlImmaginiJson,
                statoCaricamento: 'pending',
                descrizioneBreve: icecat?.descrizioneLunga?.substring(0, 160) || `Acquista ${title} al miglior prezzo.`
            },
            update: {
                title: title,
                bodyHtml: bodyHtml,
                vendor: brand,
                productType: category,
                tags: tags.join(', '),
                statoCaricamento: 'pending',
                descrizioneBreve: icecat?.descrizioneLunga?.substring(0, 160) || `Acquista ${title} al miglior prezzo.`,
                updatedAt: new Date()
            }
        });

        // 5. Salva anche in DatiIcecat/MasterFile per persistenza tra le fasi
        // Questo assicura che ShopifyExportService possa leggere i dati generati senza sovrascriverli
        if (product.datiIcecat?.id) {
            await prisma.datiIcecat.update({
                where: { id: product.datiIcecat.id },
                data: {
                    descrizioneBrave: title, // Salviamo il titolo ottimizzato
                    descrizioneLunga: bodyHtml, // Salviamo il body HTML completo
                    updatedAt: new Date()
                }
            });
            logger.info(`💾 Salvato arricchimento AI in DatiIcecat per: ${product.eanGtin}`);
        } else {
            // Se non esiste record Icecat, potremmo doverlo creare, ma di solito processBatch
            // lavora su prodotti che HANNO datiIcecat (o lo crea WebScraping prima).
            // Se siamo qui e datiIcecat è null, qualcosa è strano, ma gestiamo il caso.
            await prisma.datiIcecat.create({
                data: {
                    masterFileId: product.id,
                    eanGtin: product.eanGtin,
                    descrizioneBrave: title,
                    descrizioneLunga: bodyHtml,
                    linguaOriginale: 'it_ai'
                }
            });
        }

        logger.info(`✅ Content generato (Locale) per: ${title}`);
        return true;
    }

    /**
     * Genera handle URL friendly
     */
    private static generateHandle(title: string, id: number): string {
        const base = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return `${base}-${id}`; // Aggiungi ID per garantire unicità
    }

    /**
     * Genera titolo ottimizzato SEO
     * Formato: [BRAND] [MODELLO] - [PROCESSORE], [RAM], [STORAGE], [DISPLAY], [OS]
     * Esempio: Lenovo ThinkPad P16 Gen 2 - Intel Core i9, 32 GB RAM, SSD 1 TB, Display 16", Windows 11 Pro
     * 
     * La descrizioneBrave di Icecat è già structured:
     * "Lenovo ThinkPad P16 Gen 2, Intel® Core™ i9, 40,6 cm (16"), 2560 x 1600 Pixel, 32 GB, 1 TB, Windows 11 Pro"
     */
    private static generateOptimizedTitle(
        brand: string,
        model: string,
        category: string,
        features: any[],
        descrizioneBraveIcecat?: string
    ): string {
        // Pulisce HTML e caratteri speciali
        const cleanHtml = (input: string): string => {
            if (!input) return '';
            return input
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&egrave;/g, 'è')
                .replace(/&agrave;/g, 'à')
                .replace(/®/g, '')
                .replace(/™/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        };

        brand = cleanHtml(brand);
        const descIcecat = descrizioneBraveIcecat ? cleanHtml(descrizioneBraveIcecat) : '';

        // Helper per estrarre valori dalle specifiche
        const extractSpec = (...keys: string[]): string => {
            for (const spec of features) {
                const name = spec.name?.toLowerCase() || '';
                for (const key of keys) {
                    if (name.includes(key.toLowerCase())) {
                        return cleanHtml(spec.value || '');
                    }
                }
            }
            return '';
        };

        // === STRATEGIA 1: USA DESCRIZIONE ICECAT SE PRESENTE ===
        // La descrizione Icecat è già nel formato corretto per prodotti con specs!
        if (descIcecat && descIcecat.length > 20) {
            const parts = descIcecat.split(',');

            // Prima parte è il nome prodotto (es. "Lenovo ThinkPad P16 Gen 2")
            let productName = parts[0].trim();

            // Estrai le specifiche dalla descrizione Icecat
            let processor = '';
            let ram = '';
            let storage = '';
            let display = '';
            let os = '';

            for (let i = 1; i < parts.length; i++) {
                const part = parts[i].trim().toLowerCase();

                // Processore
                if (part.includes('intel') || part.includes('amd') || part.includes('core') ||
                    part.includes('ryzen') || part.includes('apple m')) {
                    processor = parts[i].trim();
                }
                // RAM
                else if (part.match(/^\d+\s*gb$/i) && !ram) {
                    ram = parts[i].trim() + ' RAM';
                }
                // Storage
                else if ((part.includes('gb') || part.includes('tb')) &&
                    !part.includes('ram') && !part.includes('mbit') &&
                    !ram.includes(parts[i].trim())) {
                    let storageVal = parts[i].trim();
                    if (!storageVal.toLowerCase().includes('ssd')) {
                        storageVal = 'SSD ' + storageVal;
                    }
                    storage = storageVal;
                }
                // Display (es. "40,6 cm (16")")
                else if (part.includes('cm') && part.includes('(') && part.includes('"')) {
                    const inchMatch = part.match(/\((\d+[\.,]?\d*)/);
                    if (inchMatch) {
                        display = `Display ${inchMatch[1].replace(',', '.')}"`;
                    }
                }
                // Windows
                else if (part.includes('windows')) {
                    os = parts[i].trim();
                }
            }

            // Costruisci il titolo riformattato
            const specs: string[] = [];
            if (processor) specs.push(processor);
            if (ram) specs.push(ram);
            if (storage) specs.push(storage);
            if (display) specs.push(display);
            if (os) specs.push(os);

            let title = productName;
            if (specs.length > 0) {
                title += ' - ' + specs.join(', ');
            }

            // Limita a 200 caratteri
            if (title.length > 200) {
                title = title.substring(0, 197) + '...';
            }

            return title;
        }

        // === STRATEGIA 2: COSTRUISCI DALLE SPECIFICHE TECNICHE ===

        // Determina tipo prodotto
        const formFactor = extractSpec('form factor', 'tipo', 'product type').toLowerCase();
        const catLower = category.toLowerCase();

        let tipoPC = '';
        if (formFactor.includes('notebook') || formFactor.includes('laptop') || catLower.includes('notebook')) {
            tipoPC = 'Notebook';
        } else if (formFactor.includes('desktop')) {
            tipoPC = 'Desktop';
        } else if (catLower.includes('monitor')) {
            tipoPC = 'Monitor';
        }

        // Estrai specs
        const processorFamily = extractSpec('famiglia processore', 'processor family');
        const ram = extractSpec('ram installata', 'ram', 'memory');
        const ssd = extractSpec('capacità ssd', 'ssd capacity', 'total storage');
        const screenSize = extractSpec('dimensioni diagonale schermo', 'display diagonal');
        const os = extractSpec('sistema operativo installato', 'operating system');

        // Costruisci titolo
        let title = brand;

        // Pulisci il modello
        let cleanModel = cleanHtml(model || '');
        if (cleanModel.toLowerCase().startsWith(brand.toLowerCase())) {
            cleanModel = cleanModel.substring(brand.length).trim();
        }
        if (cleanModel && !/^[\d\-]+$/.test(cleanModel)) {
            title += ` ${cleanModel}`;
        }

        if (tipoPC && !title.toLowerCase().includes(tipoPC.toLowerCase())) {
            title += ` ${tipoPC}`;
        }

        const specs: string[] = [];

        if (processorFamily) {
            specs.push(processorFamily);
        }

        if (ram) {
            specs.push(ram.includes('RAM') ? ram : ram + ' RAM');
        }

        if (ssd) {
            specs.push(ssd.toLowerCase().includes('ssd') ? ssd : 'SSD ' + ssd);
        }

        if (screenSize) {
            const inchMatch = screenSize.match(/\((\d+[\.,]?\d*)/);
            if (inchMatch) {
                specs.push(`Display ${inchMatch[1].replace(',', '.')}"`);
            }
        }

        if (os && os.toLowerCase().includes('windows 11')) {
            if (os.toLowerCase().includes('pro')) {
                specs.push('Windows 11 Pro');
            } else {
                specs.push('Windows 11');
            }
        }

        if (specs.length > 0) {
            title += ' - ' + specs.join(', ');
        }

        if (title.length > 200) {
            title = title.substring(0, 197) + '...';
        }

        return title.trim();
    }

    /**
     * Processa un batch di prodotti
     */
    static async processBatch(limit: number = 50) {
        // Trova prodotti che hanno dati Icecat ma non hanno ancora OutputShopify (o lo hanno pending)
        const products = await prisma.masterFile.findMany({
            where: {
                datiIcecat: { isNot: null },
                outputShopify: { is: null }
            },
            take: limit
        });

        logger.info(`🚀 Avvio generazione AI per ${products.length} prodotti...`);

        let success = 0;
        for (const p of products) {
            const ok = await this.generateProductContent(p.id);
            if (ok) success++;
            // Delay minimo per non sovraccaricare il DB
            await new Promise(r => setTimeout(r, 100)); // 100ms tra prodotti
        }

        return { processed: products.length, success };
    }
}
