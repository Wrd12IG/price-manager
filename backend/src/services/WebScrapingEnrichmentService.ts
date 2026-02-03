// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Servizio per l'arricchimento dati tramite AI e Web Scraping
 * 
 * Questo servizio:
 * 1. Cerca prodotti su siti web esterni (AsusStore, AsusWorld, NextHS)
 * 2. Estrae informazioni dettagliate tramite AI
 * 3. Arricchisce i prodotti che non hanno dati Icecat
 * 4. Genera descrizioni, specifiche tecniche, bullet points
 */

interface ProductSearchResult {
    found: boolean;
    url?: string;
    html?: string;
    source?: string;
}

interface AIEnrichedData {
    descrizioneBrave: string | null;
    descrizioneLunga: string | null;
    specificheTecniche: any;
    bulletPoints: string[];
    immagini: string[];
    caratteristichePrincipali: any;
}

export class WebScrapingEnrichmentService {
    private static genAI: GoogleGenerativeAI | null = null;

    /**
     * Inizializza il client Google AI
     */
    private static async initializeAI(): Promise<void> {
        if (this.genAI) return;

        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
            throw new Error('GOOGLE_AI_API_KEY non configurata');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /**
     * Cerca un prodotto sui siti web esterni
     */
    private static async searchProductOnWeb(
        ean: string,
        sku: string,
        nomeProdotto: string | null,
        marchio: string | null
    ): Promise<ProductSearchResult> {
        const searchSites = [
            {
                name: 'AsusStore',
                baseUrl: 'https://www.asustore.it',
                searchUrl: (query: string) => `https://www.asustore.it/search?q=${encodeURIComponent(query)}`
            },
            {
                name: 'AsusWorld',
                baseUrl: 'https://www.asusworld.it',
                searchUrl: (query: string) => `https://www.asusworld.it/product/?s=${encodeURIComponent(query)}`
            },
            {
                name: 'NextHS',
                baseUrl: 'https://www.nexths.it',
                searchUrl: (query: string) => `https://www.nexths.it/search?q=${encodeURIComponent(query)}`
            }
        ];

        // Prova prima con EAN, poi con SKU, poi con nome prodotto
        const searchQueries = [
            ean,
            sku,
            nomeProdotto || '',
            `${marchio || ''} ${nomeProdotto || ''}`.trim()
        ].filter(q => q.length > 0);

        for (const site of searchSites) {
            for (const query of searchQueries) {
                try {
                    logger.info(`🔍 Ricerca su ${site.name}: ${query}`);

                    const response = await axios.get(site.searchUrl(query), {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                        },
                        timeout: 10000
                    });

                    if (response.status === 200 && response.data) {
                        const $ = cheerio.load(response.data);

                        // Cerca link ai prodotti
                        const productLinks = $('a[href*="/product/"], a[href*="/p/"], a.product-link, .product a').toArray();

                        if (productLinks.length > 0) {
                            const firstProductUrl = $(productLinks[0]).attr('href');
                            if (firstProductUrl) {
                                const fullUrl = firstProductUrl.startsWith('http')
                                    ? firstProductUrl
                                    : `${site.baseUrl}${firstProductUrl}`;

                                // Scarica la pagina del prodotto
                                const productResponse = await axios.get(fullUrl, {
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                                    },
                                    timeout: 10000
                                });

                                logger.info(`✅ Prodotto trovato su ${site.name}: ${fullUrl}`);

                                return {
                                    found: true,
                                    url: fullUrl,
                                    html: productResponse.data,
                                    source: site.name
                                };
                            }
                        }
                    }
                } catch (error: any) {
                    logger.warn(`⚠️ Errore ricerca su ${site.name}:`, error.message);
                    continue;
                }
            }
        }

        return { found: false };
    }

    /**
     * Estrae dati dal HTML usando AI
     */
    private static async extractDataWithAI(
        html: string,
        ean: string,
        nomeProdotto: string | null,
        marchio: string | null
    ): Promise<AIEnrichedData> {
        await this.initializeAI();

        if (!this.genAI) {
            throw new Error('AI non inizializzata');
        }

        const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Pulisci l'HTML per ridurre la dimensione
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        const cleanedHtml = $.html().substring(0, 50000); // Limita a 50k caratteri

        const prompt = `Analizza questa pagina web di un prodotto e estrai le seguenti informazioni in formato JSON:

EAN: ${ean}
Nome Prodotto: ${nomeProdotto || 'N/D'}
Marchio: ${marchio || 'N/D'}

HTML della pagina:
${cleanedHtml}

Estrai e restituisci SOLO un oggetto JSON valido con questa struttura (senza markdown, senza backticks):
{
  "descrizioneBrave": "Descrizione breve del prodotto (max 160 caratteri)",
  "descrizioneLunga": "Descrizione dettagliata del prodotto (2-3 paragrafi)",
  "specificheTecniche": {
    "Processore": "...",
    "RAM": "...",
    "Storage": "...",
    "Display": "...",
    "Scheda Grafica": "...",
    "Sistema Operativo": "...",
    "Dimensioni": "...",
    "Peso": "...",
    "Batteria": "...",
    "Connettività": "...",
    "Porte": "..."
  },
  "bulletPoints": [
    "Punto chiave 1",
    "Punto chiave 2",
    "Punto chiave 3",
    "Punto chiave 4",
    "Punto chiave 5"
  ],
  "immagini": [
    "URL immagine 1",
    "URL immagine 2"
  ],
  "caratteristichePrincipali": {
    "Tipo PC": "Notebook/Desktop/All-in-One/...",
    "Rapporto Aspetto": "16:9/16:10/...",
    "Risoluzione Monitor": "1920x1080/...",
    "Dimensione Schermo": "15.6\"/...",
    "Tipo Processore": "Intel/AMD/...",
    "Serie Processore": "Core i7/Ryzen 7/...",
    "Tipo Storage": "SSD/HDD/Hybrid/...",
    "Capacità Storage": "512GB/..."
  }
}

IMPORTANTE: Restituisci SOLO il JSON, senza testo aggiuntivo, senza markdown, senza backticks.`;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // Pulisci la risposta da eventuali markdown
            let cleanedText = text.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
            }

            const data = JSON.parse(cleanedText);

            return {
                descrizioneBrave: data.descrizioneBrave || null,
                descrizioneLunga: data.descrizioneLunga || null,
                specificheTecniche: data.specificheTecniche || {},
                bulletPoints: data.bulletPoints || [],
                immagini: data.immagini || [],
                caratteristichePrincipali: data.caratteristichePrincipali || {}
            };
        } catch (error: any) {
            logger.error('❌ Errore estrazione dati con AI:', error.message);
            throw error;
        }
    }

    /**
     * Arricchisce un singolo prodotto usando AI e Web Scraping
     */
    static async enrichSingleProduct(masterFileProductId: number): Promise<boolean> {
        try {
            // Recupera il prodotto dal Master File
            const product = await prisma.masterFile.findUnique({
                where: { id: masterFileProductId },
                include: {
                    marchio: { select: { nome: true } },
                    categoria: { select: { nome: true } },
                    datiIcecat: true
                }
            });

            if (!product) {
                logger.warn(`⚠️ Prodotto ${masterFileProductId} non trovato`);
                return false;
            }

            // Se ha già dati Icecat, salta
            if (product.datiIcecat) {
                logger.info(`⏭️ Prodotto ${product.eanGtin} già arricchito con Icecat`);
                return false;
            }

            logger.info(`🔍 Ricerca web per prodotto: ${product.eanGtin} - ${product.nomeProdotto}`);

            // Cerca il prodotto sul web
            const searchResult = await this.searchProductOnWeb(
                product.eanGtin,
                product.skuSelezionato,
                product.nomeProdotto,
                product.marchio?.nome || null
            );

            if (!searchResult.found || !searchResult.html) {
                logger.warn(`⚠️ Prodotto ${product.eanGtin} non trovato sul web`);
                return false;
            }

            logger.info(`✅ Prodotto trovato su ${searchResult.source}: ${searchResult.url}`);

            // Estrai dati con AI
            const enrichedData = await this.extractDataWithAI(
                searchResult.html,
                product.eanGtin,
                product.nomeProdotto,
                product.marchio?.nome || null
            );

            // Salva i dati arricchiti nel database
            await prisma.datiIcecat.create({
                data: {
                    masterFileId: product.id,
                    eanGtin: product.eanGtin,
                    descrizioneBrave: enrichedData.descrizioneBrave,
                    descrizioneLunga: enrichedData.descrizioneLunga,
                    specificheTecnicheJson: JSON.stringify(enrichedData.specificheTecniche),
                    urlImmaginiJson: JSON.stringify(enrichedData.immagini),
                    bulletPointsJson: JSON.stringify(enrichedData.bulletPoints),
                    documentiJson: JSON.stringify([]),
                    linguaOriginale: 'it',
                    dataScaricamento: new Date()
                }
            });

            logger.info(`✅ Prodotto ${product.eanGtin} arricchito con successo tramite AI`);
            return true;

        } catch (error: any) {
            logger.error(`❌ Errore arricchimento prodotto ${masterFileProductId}:`, error.message);
            return false;
        }
    }

    /**
     * Arricchisce tutti i prodotti del Master File che non hanno dati Icecat
     */
    static async enrichMissingProducts(limit: number = 50): Promise<{
        total: number;
        enriched: number;
        errors: number;
    }> {
        try {
            logger.info('🚀 Inizio arricchimento prodotti mancanti con AI...');

            // Trova prodotti senza dati Icecat
            const productsWithoutIcecat = await prisma.masterFile.findMany({
                where: {
                    datiIcecat: null
                },
                take: limit,
                select: {
                    id: true,
                    eanGtin: true,
                    nomeProdotto: true
                }
            });

            logger.info(`📦 Trovati ${productsWithoutIcecat.length} prodotti da arricchire`);

            let enriched = 0;
            let errors = 0;

            for (const product of productsWithoutIcecat) {
                try {
                    const success = await this.enrichSingleProduct(product.id);
                    if (success) {
                        enriched++;
                    }

                    // Pausa tra le richieste per evitare rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (error: any) {
                    logger.error(`❌ Errore arricchimento ${product.eanGtin}:`, error.message);
                    errors++;
                }
            }

            logger.info(`✅ Arricchimento completato: ${enriched} successi, ${errors} errori`);

            return {
                total: productsWithoutIcecat.length,
                enriched,
                errors
            };

        } catch (error: any) {
            logger.error('❌ Errore durante l\'arricchimento:', error.message);
            throw error;
        }
    }

    /**
     * Ottiene statistiche sull'arricchimento
     */
    static async getEnrichmentStats(): Promise<{
        totalProducts: number;
        withIcecat: number;
        missing: number;
    }> {
        const totalProducts = await prisma.masterFile.count();
        const withIcecat = await prisma.masterFile.count({
            where: {
                datiIcecat: {
                    isNot: null
                }
            }
        });

        return {
            totalProducts,
            withIcecat,
            missing: totalProducts - withIcecat
        };
    }
}
