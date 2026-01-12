import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import prisma from '../config/database';

export class AIMetafieldService {
    private static genAI: GoogleGenerativeAI | null = null;
    private static model: any = null;

    private static initialize() {
        if (!this.genAI) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                logger.warn('GEMINI_API_KEY not configured.');
                return false;
            }
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
            logger.info('Google Gemini AI initialized for metafield generation');
        }
        return true;
    }

    static async generateMetafields(product: any): Promise<Record<string, string> | null> {
        if (!this.initialize()) return null;

        try {
            // Prepare product info for the prompt
            const icecat = product.datiIcecat;
            const features = icecat?.specificheTecnicheJson ? JSON.parse(icecat.specificheTecnicheJson) : [];
            const bullets = icecat?.bulletPointsJson ? JSON.parse(icecat.bulletPointsJson) : [];

            // Format features for the prompt
            const featuresText = Array.isArray(features)
                ? features.map((f: any) => `${f.name || f.Feature?.Name?.Value}: ${f.value || f.PresentationValue}`).join('\n')
                : JSON.stringify(features);

            const prompt = `Analizza questo prodotto e-commerce e compila i seguenti metafields.

PRODOTTO:
Titolo: ${product.nomeProdotto || icecat?.descrizioneBrave || ''}
Marca: ${product.marca || ''}
Categoria: ${product.categoriaEcommerce || ''}
Descrizione Icecat: ${icecat?.descrizioneLunga || ''}
Bullet Points: ${bullets.join('; ')}
Specifiche Tecniche:
${featuresText.substring(0, 3000)}

METAFIELDS DA COMPILARE (formato: Campo|Valore):

Rapporto Aspetto|[es: 16:9, 16:10, 3:2]
Risoluzione Monitor|[es: 1920x1080, 2560x1440]
Dimensione Monitor|[es: 13.3", 15.6", 17.3"]
Tipo PC|[es: Notebook, Desktop, All-in-One, Mini PC, 2-in-1]
Capacità SSD|[es: 512GB, 1TB, 512GB SSD + 1TB HDD]
Scheda Video|[es: Intel Iris Xe, NVIDIA GeForce RTX 4050 6GB]
Marca|[es: ASUS, Lenovo, HP, Dell]
Sistema Operativo|[es: Windows 11 Home, Windows 11 Pro, FreeDOS]
Ram|[es: 8GB DDR4, 16GB DDR5]
Processore Brand|[es: Intel Core i5-13500H, AMD Ryzen 7 7730U]
EAN|[codice 13 cifre, lascia vuoto se non disponibile]
Descrizione Breve|[max 150 caratteri, accattivante]
Descrizione Lunga|[300-500 parole, SEO-friendly, strutturata in 4 paragrafi: Intro, Specifiche, Utilizzi, Conclusione]
Tabella Specifiche|[HTML table completo con tutte le specifiche, stile pulito]

REGOLE:
- Formato OUTPUT: Campo|Valore (separatore pipe |)
- Un campo per riga
- Se un dato non è disponibile, lascia il valore vuoto dopo il pipe
- Descrizione Lunga: Usa tag HTML <p>, <h3>, <ul>, <li>
- Tabella Specifiche: HTML con <table style="width:100%; border-collapse:collapse;">, celle con border:1px solid #ddd; padding:8px;

OUTPUT (solo i dati, senza preamble):`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse response
            const metafields: Record<string, string> = {};
            const lines = text.trim().split('\n');

            const mapping: Record<string, string> = {
                "Rapporto Aspetto": "custom.rapporto_aspetto",
                "Risoluzione Monitor": "custom.risoluzione_monitor",
                "Dimensione Monitor": "custom.dimensione_monitor",
                "Tipo PC": "custom.tipo_pc",
                "Capacità SSD": "custom.capacita_ssd",
                "Scheda Video": "custom.scheda_video",
                "Marca": "custom.marca",
                "Sistema Operativo": "custom.sistema_operativo",
                "Ram": "custom.ram",
                "Processore Brand": "custom.processore_brand",
                "EAN": "custom.ean",
                "Descrizione Breve": "custom.descrizione_breve",
                "Descrizione Lunga": "custom.descrizione_lunga",
                "Tabella Specifiche": "custom.tabella_specifiche"
            };

            for (const line of lines) {
                if (line.includes('|')) {
                    const [key, value] = line.split('|', 2);
                    const cleanKey = key.trim();
                    const cleanValue = value ? value.trim() : '';

                    if (mapping[cleanKey] && cleanValue) {
                        metafields[mapping[cleanKey]] = cleanValue;
                    }
                }
            }

            return metafields;

        } catch (error: any) {
            logger.error(`Error generating AI metafields for product ${product.id}: ${error.message}`);
            return null;
        }
    }
}
