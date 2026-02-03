// @ts-nocheck
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';

export class AutoMappingService {
    private static genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

    /**
     * Analizza un campione di dati e suggerisce la mappatura dei campi
     */
    static async suggestMapping(sampleRows: any[]): Promise<any> {
        try {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY non configurata');
            }

            const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `Analizza queste prime righe di un listino fornitori e suggerisci la mappatura dei campi standard.
            Campi richiesti (obbligatori per Shopify/Gestione):
            - ean: Il codice a barre (EAN13/GTIN)
            - prezzo: Il prezzo di acquisto (costo fornitore)
            - nome: Descrizione del prodotto o nome commerciale
            - marca: Il produttore o brand del prodotto (fondamentale)
            - categoria: Categoria merceologica
            - sku: Codice identificativo interno del fornitore
            - part_number: Il codice prodotto del produttore (Manufacturer Part Number / MPN / Codice Produttore)
            - quantita: Disponibilità a magazzino o stock

            Dati d'esempio (JSON):
            ${JSON.stringify(sampleRows, null, 2)}

            Restituisci esclusivamente un JSON con questa struttura:
            {
              "ean": "nome_colonna_originale",
              "prezzo": "nome_colonna_originale",
              "nome": "nome_colonna_originale",
              "marca": "nome_colonna_originale",
              "categoria": "nome_colonna_originale",
              "sku": "nome_colonna_originale",
              "part_number": "nome_colonna_originale",
              "quantita": "nome_colonna_originale"
            }
            Se un campo non è presente, usa null come valore.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/\{.*\}/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            throw new Error('Impossibile estrarre JSON dalla risposta AI');
        } catch (e: any) {
            logger.error(`Error in AutoMappingService: ${e.message}`);
            return null;
        }
    }
}
