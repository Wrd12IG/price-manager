// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Servizio Avanzato per la Generazione Metafields Shopify
 * 
 * Strategia Multi-Layer:
 * 1. Estrazione da dati ICECAT (se disponibili)
 * 2. Web Scraping + AI (se dati incompleti)
 * 3. Validazione 100% del prodotto trovato
 * 4. NO invenzioni - solo dati verificati
 */

interface ProductData {
    id: number;
    eanGtin: string;
    partNumber?: string | null;
    nomeProdotto: string | null;
    marchio?: { nome: string } | null;
    categoria?: { nome: string } | null;
    datiIcecat?: any;
}

interface WebSearchResult {
    found: boolean;
    url?: string;
    html?: string;
    source?: string;
    validated: boolean; // Se il prodotto è verificato al 100%
}

interface ExtractedMetafields {
    'custom.ean'?: string;
    'custom.marca'?: string;
    'custom.categoria_prodotto'?: string;
    'custom.processore_brand'?: string;
    'custom.ram'?: string;
    'custom.capacita_ssd'?: string;
    'custom.dimensione_monitor'?: string;
    'custom.sistema_operativo'?: string;
    'custom.scheda_video'?: string;
    'custom.risoluzione_monitor'?: string;
    'custom.rapporto_aspetto'?: string;
    'custom.tipo_pc'?: string;
    'custom.descrizione_breve'?: string;
    'custom.descrizione_lunga'?: string;
    'custom.tabella_specifiche'?: string;
    'custom.peso'?: string;
    'custom.batteria'?: string;
    'custom.connettivita'?: string;
    'custom.porte'?: string;
}

export class EnhancedMetafieldService {
    private static genAI: GoogleGenerativeAI | null = null;

    /**
     * Siti web autorizzati per il web scraping
     */
    private static AUTHORIZED_SITES = [
        {
            name: 'ASUS Official IT',
            baseUrl: 'https://www.asus.com',
            searchUrl: (query: string) => `https://www.asus.com/it/search/?q=${encodeURIComponent(query)}`,
            productSelector: 'a[href*="/it/"], a.product-link, .product-item a',
            trustScore: 10 // Sito ufficiale ASUS - massima affidabilità
        },
        {
            name: 'MediaWorld',
            baseUrl: 'https://www.mediaworld.it',
            searchUrl: (query: string) => `https://www.mediaworld.it/search?q=${encodeURIComponent(query)}`,
            productSelector: 'a[href*="/product/"]',
            trustScore: 9 // Affidabilità del sito (1-10)
        },
        {
            name: 'AsusStore',
            baseUrl: 'https://www.asustore.it',
            searchUrl: (query: string) => `https://www.asustore.it/search?q=${encodeURIComponent(query)}`,
            productSelector: 'a[href*="/products/"]',
            trustScore: 10
        },
        {
            name: 'AsusWorld',
            baseUrl: 'https://www.asusworld.it',
            searchUrl: (query: string) => `https://www.asusworld.it/it-IT/search?q=${encodeURIComponent(query)}`,
            productSelector: 'a.product-item',
            trustScore: 10
        }
    ];

    /**
     * Inizializza Google AI
     */
    private static async initializeAI(utenteId: number): Promise<void> {
        if (this.genAI) return;

        // Prova a ottenere la chiave API dall'utente o dal sistema
        const apiKey = await this.getApiKey(utenteId);
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY non configurata');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    private static async getApiKey(utenteId: number): Promise<string | null> {
        try {
            const personal = await prisma.configurazioneSistema.findFirst({
                where: { utenteId, chiave: 'GEMINI_API_KEY' }
            });
            if (personal?.valore) return personal.valore;

            const global = await prisma.configurazioneSistema.findFirst({
                where: { utenteId: null, chiave: 'GEMINI_API_KEY' }
            });
            return global?.valore || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        } catch (error) {
            return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || null;
        }
    }

    /**
     * LAYER 1: Estrazione metafields da ICECAT
     */
    private static extractFromIcecat(product: ProductData): ExtractedMetafields {
        const metafields: ExtractedMetafields = {};
        const icecat = product.datiIcecat;

        if (!icecat) return metafields;

        // Dati base
        if (product.eanGtin) metafields['custom.ean'] = product.eanGtin;
        if (product.marchio?.nome) metafields['custom.marca'] = product.marchio.nome;
        if (product.categoria?.nome) metafields['custom.categoria_prodotto'] = product.categoria.nome;

        // Descrizioni
        if (icecat.descrizioneBrave) {
            metafields['custom.descrizione_breve'] = icecat.descrizioneBrave;
        }
        if (icecat.descrizioneLunga) {
            metafields['custom.descrizione_lunga'] = icecat.descrizioneLunga;
        }

        // Specifiche tecniche
        if (icecat.specificheTecnicheJson) {
            try {
                const specs = JSON.parse(icecat.specificheTecnicheJson);

                // Genera tabella HTML
                const tableHtml = this.generateSpecsTable(specs);
                if (tableHtml) metafields['custom.tabella_specifiche'] = tableHtml;

                // Estrai specifiche individuali
                this.extractIndividualSpecs(specs, metafields);
            } catch (e) {
                logger.warn('Errore parsing specifiche ICECAT:', e);
            }
        }

        return metafields;
    }

    /**
     * Genera tabella HTML dalle specifiche
     */
    private static generateSpecsTable(specs: any): string | null {
        if (!specs) return null;

        const specsList = Array.isArray(specs)
            ? specs
            : Object.entries(specs).map(([name, value]) => ({ name, value }));

        if (specsList.length === 0) return null;

        let tableHtml = '<table style="width:100%; border-collapse:collapse;">';
        let rowsAdded = 0;

        for (const spec of specsList) {
            const name = spec.name || spec.Feature?.Name?.Value || spec.key || '';
            const value = spec.value || spec.PresentationValue || '';

            if (!name || !value) continue;

            rowsAdded++;
            tableHtml += `<tr>`;
            tableHtml += `<td style="border:1px solid #ddd; padding:8px; background-color:#f2f2f2;"><strong>${this.escapeHtml(name)}</strong></td>`;
            tableHtml += `<td style="border:1px solid #ddd; padding:8px;">${this.escapeHtml(String(value))}</td>`;
            tableHtml += `</tr>`;
        }

        tableHtml += '</table>';
        return rowsAdded > 0 ? tableHtml : null;
    }

    /**
     * Estrae specifiche individuali da un array/oggetto di specifiche
     */
    private static extractIndividualSpecs(specs: any, metafields: ExtractedMetafields): void {
        const specsList = Array.isArray(specs)
            ? specs
            : Object.entries(specs).map(([name, value]) => ({ name, value }));

        for (const spec of specsList) {
            const name = (spec.name || spec.Feature?.Name?.Value || '').toLowerCase();
            const value = String(spec.value || spec.PresentationValue || '').trim();

            if (!value) continue;

            // Processore
            if (name.includes('processor') || name.includes('cpu') || name.includes('processore')) {
                if (!metafields['custom.processore_brand']) {
                    metafields['custom.processore_brand'] = value;
                }
            }

            // RAM
            if (name.includes('ram') || name.includes('memoria')) {
                if (!metafields['custom.ram']) {
                    metafields['custom.ram'] = value;
                }
            }

            // Storage
            if (name.includes('storage') || name.includes('ssd') || name.includes('hdd') || name.includes('archiviazione')) {
                if (!metafields['custom.capacita_ssd']) {
                    metafields['custom.capacita_ssd'] = value;
                }
            }

            // Display
            if (name.includes('display') || name.includes('schermo') || name.includes('screen')) {
                if (!metafields['custom.dimensione_monitor']) {
                    metafields['custom.dimensione_monitor'] = value;
                }
            }

            // Risoluzione
            if (name.includes('resolution') || name.includes('risoluzione')) {
                if (!metafields['custom.risoluzione_monitor']) {
                    metafields['custom.risoluzione_monitor'] = value;
                }
            }

            // Sistema Operativo
            if (name.includes('operating system') || name.includes('sistema operativo') || name.includes('os')) {
                if (!metafields['custom.sistema_operativo']) {
                    metafields['custom.sistema_operativo'] = value;
                }
            }

            // GPU
            if (name.includes('graphics') || name.includes('gpu') || name.includes('scheda video') || name.includes('video card')) {
                if (!metafields['custom.scheda_video']) {
                    metafields['custom.scheda_video'] = value;
                }
            }

            // Peso
            if (name.includes('weight') || name.includes('peso')) {
                if (!metafields['custom.peso']) {
                    metafields['custom.peso'] = value;
                }
            }

            // Batteria
            if (name.includes('battery') || name.includes('batteria')) {
                if (!metafields['custom.batteria']) {
                    metafields['custom.batteria'] = value;
                }
            }
        }
    }

    /**
     * LAYER 2: Web Scraping con validazione
     */
    private static async searchProductOnWeb(product: ProductData): Promise<WebSearchResult> {
        const searchQueries = [
            product.eanGtin,
            product.partNumber,
            `${product.marchio?.nome || ''} ${product.partNumber || ''}`.trim(),
            product.nomeProdotto
        ].filter(q => q && q.length > 3);

        for (const site of this.AUTHORIZED_SITES) {
            for (const query of searchQueries) {
                try {
                    logger.info(`🔍 Ricerca prodotto su ${site.name}: ${query}`);

                    const response = await axios.get(site.searchUrl(query), {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        timeout: 15000
                    });

                    if (response.status !== 200) continue;

                    const $ = cheerio.load(response.data);
                    const productLinks = $(site.productSelector).toArray();

                    if (productLinks.length === 0) continue;

                    // Prova il primo risultato
                    const firstLink = $(productLinks[0]).attr('href');
                    if (!firstLink) continue;

                    const fullUrl = firstLink.startsWith('http')
                        ? firstLink
                        : `${site.baseUrl}${firstLink}`;

                    // Scarica la pagina del prodotto
                    const productResponse = await axios.get(fullUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        },
                        timeout: 15000
                    });

                    const htmlContent = productResponse.data;

                    // VALIDAZIONE: Verifica che sia il prodotto corretto
                    const isValid = await this.validateProduct(htmlContent, product);

                    logger.info(`${isValid ? '✅' : '⚠️'} Prodotto trovato su ${site.name}: ${fullUrl} (Validato: ${isValid})`);

                    return {
                        found: true,
                        url: fullUrl,
                        html: htmlContent,
                        source: site.name,
                        validated: isValid
                    };

                } catch (error: any) {
                    logger.warn(`⚠️ Errore ricerca su ${site.name}:`, error.message);
                    continue;
                }

                // Pausa tra le richieste
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return { found: false, validated: false };
    }

    /**
     * Valida che il prodotto web corrisponda al 100% con quello del database
     */
    private static async validateProduct(html: string, product: ProductData): Promise<boolean> {
        const $ = cheerio.load(html);
        const pageText = $('body').text().toLowerCase();

        // Validazione EAN (massima priorità)
        if (product.eanGtin && pageText.includes(product.eanGtin.toLowerCase())) {
            logger.info(`✅ Validazione EAN OK: ${product.eanGtin}`);
            return true;
        }

        // Validazione Part Number
        if (product.partNumber && pageText.includes(product.partNumber.toLowerCase())) {
            logger.info(`✅ Validazione Part Number OK: ${product.partNumber}`);
            return true;
        }

        // Se né EAN né Part Number sono trovati, NON è valido
        logger.warn(`⚠️ Validazione FALLITA: EAN o Part Number non trovati nella pagina`);
        return false;
    }

    /**
     * LAYER 3: Estrazione con AI dal web
     */
    private static async extractFromWebWithAI(
        html: string,
        product: ProductData,
        utenteId: number
    ): Promise<ExtractedMetafields> {
        await this.initializeAI(utenteId);

        if (!this.genAI) {
            throw new Error('AI non inizializzata');
        }

        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Pulisci HTML
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header, .cookie').remove();
        const cleanedHtml = $.html().substring(0, 40000);

        const prompt = `Analizza questa pagina web di un prodotto e-commerce ed estrai SOLO informazioni verificabili al 100%.

PRODOTTO DA VALIDARE:
- EAN: ${product.eanGtin}
- Part Number: ${product.partNumber || 'N/D'}
- Nome: ${product.nomeProdotto || 'N/D'}
- Marca: ${product.marchio?.nome || 'N/D'}

HTML PAGINA:
${cleanedHtml}

REGOLE CRITICHE:
1. Verifica che l'EAN o Part Number corrisponda ESATTAMENTE
2. NON inventare NESSUNA specifica
3. Se un dato non è chiaramente visibile nella pagina, lascia il campo vuoto
4. Estrai SOLO dati presenti letteralmente nella pagina

Restituisci SOLO un JSON valido (senza markdown, senza backticks):
{
  "processore_brand": "testo esatto dalla pagina o null",
  "ram": "testo esatto dalla pagina o null",
  "capacita_ssd": "testo esatto dalla pagina o null",
  "dimensione_monitor": "testo esatto dalla pagina o null",
  "risoluzione_monitor": "testo esatto dalla pagina o null",
  "sistema_operativo": "testo esatto dalla pagina o null",
  "scheda_video": "testo esatto dalla pagina o null",
  "tipo_pc": "Notebook/Desktop/All-in-One/Mini PC/2-in-1 o null",
  "rapporto_aspetto": "16:9/16:10/3:2 o null",
  "descrizione_breve": "max 150 caratteri dalla pagina o null",
  "descrizione_lunga": "descrizione completa dalla pagina o null",
  "peso": "peso prodotto o null",
  "batteria": "specifiche batteria o null",
  "connettivita": "WiFi, Bluetooth, etc o null",
  "porte": "USB, HDMI, etc o null"
}`;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();

            // Rimuovi markdown se presente
            text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');

            const data = JSON.parse(text);
            const metafields: ExtractedMetafields = {};

            // Converti in formato metafields solo se i valori sono validi
            if (data.processore_brand) metafields['custom.processore_brand'] = data.processore_brand;
            if (data.ram) metafields['custom.ram'] = data.ram;
            if (data.capacita_ssd) metafields['custom.capacita_ssd'] = data.capacita_ssd;
            if (data.dimensione_monitor) metafields['custom.dimensione_monitor'] = data.dimensione_monitor;
            if (data.risoluzione_monitor) metafields['custom.risoluzione_monitor'] = data.risoluzione_monitor;
            if (data.sistema_operativo) metafields['custom.sistema_operativo'] = data.sistema_operativo;
            if (data.scheda_video) metafields['custom.scheda_video'] = data.scheda_video;
            if (data.tipo_pc) metafields['custom.tipo_pc'] = data.tipo_pc;
            if (data.rapporto_aspetto) metafields['custom.rapporto_aspetto'] = data.rapporto_aspetto;
            if (data.descrizione_breve) metafields['custom.descrizione_breve'] = data.descrizione_breve;
            if (data.descrizione_lunga) metafields['custom.descrizione_lunga'] = data.descrizione_lunga;
            if (data.peso) metafields['custom.peso'] = data.peso;
            if (data.batteria) metafields['custom.batteria'] = data.batteria;
            if (data.connettivita) metafields['custom.connettivita'] = data.connettivita;
            if (data.porte) metafields['custom.porte'] = data.porte;

            return metafields;

        } catch (error: any) {
            logger.error('❌ Errore estrazione AI dal web:', error.message);
            return {};
        }
    }

    /**
     * METODO PRINCIPALE: Genera metafields completi con strategia multi-layer
     */
    static async generateCompleteMetafields(
        utenteId: number,
        product: ProductData
    ): Promise<ExtractedMetafields> {
        logger.info(`📦 Generazione metafields per: ${product.eanGtin} - ${product.nomeProdotto}`);

        let metafields: ExtractedMetafields = {};

        // LAYER 1: Estrai da ICECAT
        if (product.datiIcecat) {
            logger.info('📊 Layer 1: Estrazione da ICECAT...');
            metafields = this.extractFromIcecat(product);
            logger.info(`✅ Estratti ${Object.keys(metafields).length} metafields da ICECAT`);
        }

        // Verifica completezza
        const requiredFields = [
            'custom.processore_brand',
            'custom.ram',
            'custom.capacita_ssd',
            'custom.scheda_video',
            'custom.sistema_operativo'
        ];

        const missingFields = requiredFields.filter(field => !metafields[field]);

        // LAYER 2 & 3: Se mancano dati critici, usa web scraping + AI
        if (missingFields.length > 0) {
            logger.info(`⚠️ Mancano ${missingFields.length} campi critici, attivo web scraping...`);

            const webResult = await this.searchProductOnWeb(product);

            if (webResult.found && webResult.validated && webResult.html) {
                logger.info(`🤖 Layer 2-3: Estrazione AI dal web (${webResult.source})...`);

                const webMetafields = await this.extractFromWebWithAI(
                    webResult.html,
                    product,
                    utenteId
                );

                // Merge: i dati web completano quelli ICECAT (non li sovrascrivono)
                metafields = { ...webMetafields, ...metafields };

                logger.info(`✅ Completati ${Object.keys(webMetafields).length} metafields aggiuntivi dal web`);
            } else {
                logger.warn(`⚠️ Prodotto non trovato o non validato sul web`);
            }
        }

        logger.info(`✅ Totale metafields generati: ${Object.keys(metafields).length}`);
        return metafields;
    }

    /**
     * Utility: Escape HTML
     */
    private static escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}
