import prisma from '../config/database';
import { logger } from '../utils/logger';
import { AIDescriptionService } from './AIDescriptionService';
import { AITitleService } from './AITitleService';

/**
 * Servizio per generare export Shopify con tutti i metafields richiesti
 */

interface ShopifyProduct {
    // Campi base
    ean: string;
    nome: string;
    marca: string;
    tags: string;
    prezzo: number;
    quantita: number;
    immagini: string[]; // Array di URL
    productCode: string; // Codice prodotto originale del fornitore

    // Metafields Display
    famiglia: string;
    tipologiaDisplay: string;
    touchScreen: string;
    rapportoAspetto: string;
    'risoluzione Monitor': string;
    dimensioneMonitor: string;
    dimensioneSchermo: string;
    display: string; // Descrizione completa display

    // Metafields PC
    tipoPC: string;
    capacitaSSD: string;
    schedaVideo: string;
    sistemaOperativo: string;
    ram: string;
    processoreBrand: string;
    cpu: string; // Modello completo processore

    // Contenuti
    descrizioneBrave: string;
    descrizioneLunga: string;
    testoPersonalizzato: string;
    tabellaSpecifiche: string; // HTML

    // File
    schedaPDF: string;
}

export class ShopifyExportService {

    /**
     * Estrae valore da specifiche tecniche JSON
     */
    private static extractSpecValue(specifiche: any, ...possibleKeys: string[]): string {
        if (!specifiche || !Array.isArray(specifiche)) return '';

        for (const spec of specifiche) {
            const name = spec.name?.toLowerCase() || '';
            const value = spec.value || '';

            for (const key of possibleKeys) {
                if (name.includes(key.toLowerCase())) {
                    return value;
                }
            }
        }

        return '';
    }

    /**
     * Determina la tipologia di display - SOLO se il prodotto ha un display
     */
    private static detectDisplayType(specifiche: any): string {
        // Cerca in vari campi possibili
        let displayTech = this.extractSpecValue(specifiche,
            'display technology', 'tecnologia display', 'tipo display', 'panel type',
            'tipo pannello', 'tecnologia pannello', 'display panel type'
        ).toLowerCase();

        // Cerca anche in superficie/tipo schermo
        if (!displayTech) {
            displayTech = this.extractSpecValue(specifiche,
                'tipo schermo', 'screen type', 'display type', 'tipo di display'
            ).toLowerCase();
        }

        // Cerca anche nei flag specifici
        const hasLED = this.extractSpecValue(specifiche,
            'retroilluminazione a led', 'led backlight', 'led-backlit'
        ).toLowerCase();

        const hasIPS = this.extractSpecValue(specifiche,
            'ips', 'ips-level', 'livello ips', 'pannello ips',
            'tipologia pannello display', 'tipologia pannello'
        ).toLowerCase();

        // Logica di determinazione
        if (displayTech.includes('oled')) return 'OLED';
        if (displayTech.includes('amoled')) return 'AMOLED';
        if (displayTech.includes('mini-led') || displayTech.includes('mini led')) return 'Mini-LED';
        if (displayTech.includes('ips')) return 'IPS';
        if (displayTech.includes('va')) return 'VA';
        if (displayTech.includes('tn')) return 'TN';

        // Se ha IPS nel flag o nel valore
        if (hasIPS.includes('ips') || hasIPS.includes('sì') || hasIPS.includes('yes') || hasIPS.includes('si')) return 'IPS';

        // Se ha LED backlight e non altro, è probabilmente LED-LCD
        if (hasLED.includes('sì') || hasLED.includes('yes') || hasLED.includes('si')) return 'LED';

        if (displayTech.includes('led')) return 'LED';
        if (displayTech.includes('lcd')) return 'LCD';

        return ''; // No default - restituisce vuoto se non identificato
    }

    /**
     * Determina se ha touchscreen - SOLO se esplicitamente dichiarato
     */
    private static detectTouchScreen(specifiche: any, nomeProdotto: string): string {
        const touchValue = this.extractSpecValue(specifiche,
            'touchscreen', 'touch screen', 'touch-screen', 'touch'
        ).toLowerCase();

        if (touchValue.includes('yes') || touchValue.includes('sì') || touchValue.includes('si') || touchValue.includes('true')) {
            return 'Sì';
        }

        if (touchValue.includes('no') || touchValue.includes('false')) {
            return 'No';
        }

        // Controllo più rigoroso sul nome
        if (nomeProdotto) {
            const lowerName = nomeProdotto.toLowerCase();
            if (lowerName.includes('touchscreen') && !lowerName.includes('no touch') && !lowerName.includes('non-touch')) {
                return 'Sì';
            }
        }

        return '';
    }

    /**
     * Determina rapporto aspetto - SOLO se trovato nelle specifiche
     */
    private static detectAspectRatio(specifiche: any): string {
        const ratio = this.extractSpecValue(specifiche,
            'aspect ratio', 'rapporto aspetto', 'display aspect ratio'
        );

        if (!ratio) return ''; // Nessun dato trovato

        if (ratio.includes('16:10')) return '16:10';
        if (ratio.includes('16:9')) return '16:9';
        if (ratio.includes('21:9')) return '21:9';
        if (ratio.includes('4:3')) return '4:3';
        if (ratio.includes('3:2')) return '3:2';
        if (ratio.includes('32:9')) return '32:9';

        return ratio; // Restituisce il valore originale se non mappato
    }

    /**
     * Determina risoluzione monitor - SOLO se trovata nelle specifiche
     */
    private static detectResolution(specifiche: any): string {
        const resolution = this.extractSpecValue(specifiche,
            'resolution', 'risoluzione', 'display resolution', 'native resolution'
        ).toLowerCase();

        if (!resolution) return ''; // Nessun dato trovato

        if (resolution.includes('3840') || resolution.includes('4k') || resolution.includes('uhd')) {
            return '4K';
        }
        if (resolution.includes('2560') || resolution.includes('qhd') || resolution.includes('quad hd')) {
            return 'QHD';
        }
        if (resolution.includes('1920') || resolution.includes('1080') || resolution.includes('full hd') || resolution.includes('fhd')) {
            return 'Full HD';
        }
        if (resolution.includes('1366') || resolution.includes('768') || resolution.includes('hd ready')) {
            return 'HD';
        }
        if (resolution.includes('7680') || resolution.includes('8k')) {
            return '8K';
        }

        return ''; // No default
    }

    /**
     * Determina dimensione schermo con risoluzione - SOLO se trovata
     */
    private static detectScreenSize(specifiche: any): string {
        const resolution = this.detectResolution(specifiche);

        if (!resolution) return ''; // Nessuna risoluzione trovata

        const mapping: { [key: string]: string } = {
            'HD': 'HD Ready: 1366 × 768 px',
            'Full HD': 'Full HD (FHD): 1920 × 1080 px',
            'QHD': 'Quad HD (QHD): 2560 × 1440 px',
            '4K': '4K (UHD): 3840 × 2160 px',
            '8K': '8K: 7680 × 4320 px'
        };

        return mapping[resolution] || '';
    }

    /**
     * Determina dimensione monitor in pollici - SOLO se trovata nelle specifiche
     */
    private static detectMonitorSize(specifiche: any): string {
        const size = this.extractSpecValue(specifiche,
            'dimensioni diagonale schermo', 'display diagonal', 'screen size', 'display size',
            'dimensione schermo'
        );

        if (!size) return ''; // Nessun dato trovato

        // Estrai solo il valore in pollici se presente nel formato "39,6 cm (15.6")"
        const inchMatch = size.match(/\((\d+\.?\d*)[\"']/);
        if (inchMatch) {
            const inches = parseFloat(inchMatch[1]);
            if (inches >= 13 && inches < 14) return '13" - 13,3 pollici';
            if (inches >= 14 && inches < 15) return '14 pollici';
            if (inches >= 15 && inches <= 15.6) return '15" - 15,6 pollici';
            if (inches >= 17 && inches < 18) return '17 pollici';
            if (inches >= 11 && inches < 13) return '11" - 12 pollici';
            if (inches >= 23 && inches < 25) return '24 pollici';
            if (inches >= 26 && inches < 28) return '27 pollici';
            if (inches >= 31 && inches < 33) return '32 pollici';
        }

        const inches = parseFloat(size);
        if (!isNaN(inches)) {
            if (inches >= 13 && inches < 14) return '13" - 13,3 pollici';
            if (inches >= 14 && inches < 15) return '14 pollici';
            if (inches >= 15 && inches <= 15.6) return '15" - 15,6 pollici';
            if (inches >= 17 && inches < 18) return '17 pollici';
            if (inches >= 11 && inches < 13) return '11" - 12 pollici';
            if (inches >= 23 && inches < 25) return '24 pollici';
            if (inches >= 26 && inches < 28) return '27 pollici';
            if (inches >= 31 && inches < 33) return '32 pollici';
        }

        return size; // Restituisce il valore originale
    }

    /**
     * Determina tipo PC - SOLO se il prodotto è effettivamente un PC
     */
    private static detectPCType(specifiche: any, categoria: string | null): string {
        // Prima verifica se la categoria è pertinente
        const categoriaLower = categoria?.toLowerCase() || '';

        // Categorie che NON sono PC
        const nonPCCategories = [
            'ventole', 'case ventole', 'accessori', 'cavi', 'alimentatori',
            'mouse', 'tastiere', 'periferiche', 'storage', 'hdd', 'ssd',
            'ram', 'memoria', 'schede video', 'gpu', 'motherboard',
            'componenti', 'networking', 'router', 'switch'
        ];

        if (nonPCCategories.some(cat => categoriaLower.includes(cat))) {
            return ''; // Non è un PC, non applicare tipo PC
        }

        const formFactor = this.extractSpecValue(specifiche,
            'form factor', 'tipo', 'product type', 'tipo prodotto'
        ).toLowerCase();

        if (formFactor.includes('notebook') || formFactor.includes('laptop')) return 'Notebook';
        if (formFactor.includes('desktop')) return 'Desktop';
        if (formFactor.includes('all-in-one') || formFactor.includes('aio')) return 'All-in-One';
        if (formFactor.includes('workstation')) return 'Workstation';
        if (formFactor.includes('gaming')) return 'Gaming PC';
        if (formFactor.includes('mini pc')) return 'Mini PC';
        if (formFactor.includes('tablet')) return 'Tablet';

        // Verifica dalla categoria
        if (categoriaLower.includes('notebook')) return 'Notebook';
        if (categoriaLower.includes('desktop')) return 'Desktop';
        if (categoriaLower.includes('laptop')) return 'Notebook';
        if (categoriaLower.includes('pc portatili')) return 'Notebook';
        if (categoriaLower.includes('tablet')) return 'Tablet';

        return ''; // No default! Non assumere che sia un notebook
    }

    /**
     * Estrae capacità SSD
     */
    private static extractSSDCapacity(specifiche: any): string {
        const storage = this.extractSpecValue(specifiche,
            'ssd capacity', 'capacità ssd', 'storage', 'ssd', 'total storage capacity'
        );

        return storage || '';
    }

    /**
     * Estrae scheda video (GPU)
     */
    private static extractGPU(specifiche: any): string {
        // Prima cerca modello GPU dedicata
        let gpu = this.extractSpecValue(specifiche,
            'modello scheda grafica dedicata', 'discrete graphics adapter model',
            'dedicated graphics card model'
        );

        // Se non c'è dedicata, cerca il modello di quella integrata
        if (!gpu || gpu.toLowerCase() === 'non disponibile' || gpu.toLowerCase() === 'no') {
            gpu = this.extractSpecValue(specifiche,
                'modello scheda grafica integrata', 'on-board graphics adapter model',
                'integrated graphics model'
            );
        }

        // Escudi valori inutili (Sì, No, Non disponibile)
        if (gpu && (gpu.toLowerCase() === 'sì' || gpu.toLowerCase() === 'si' ||
            gpu.toLowerCase() === 'no' || gpu.toLowerCase() === 'non disponibile')) {
            return '';
        }

        return gpu || '';
    }

    /**
     * Estrae sistema operativo
     */
    private static extractOS(specifiche: any): string {
        // Cerca sistema operativo installato
        let os = this.extractSpecValue(specifiche,
            'sistema operativo installato', 'operating system installed', 'preinstalled os'
        );

        // Se non trovato, cerca OS generico
        if (!os) {
            os = this.extractSpecValue(specifiche,
                'operating system', 'sistema operativo'
            );
        }

        // Non restituire valori inutili
        if (os && (os.toLowerCase() === 'no' || os.toLowerCase() === 'non disponibile')) {
            return '';
        }

        return os || '';
    }

    /**
     * Estrae RAM
     */
    private static extractRAM(specifiche: any): string {
        const ram = this.extractSpecValue(specifiche,
            'memory', 'ram', 'memoria', 'internal memory'
        );

        return ram || '';
    }

    /**
     * Estrae brand processore
     */
    private static extractProcessorBrand(specifiche: any): string {
        // Prima cerca il produttore
        let brand = this.extractSpecValue(specifiche,
            'produttore processore', 'processor manufacturer', 'cpu manufacturer'
        );

        // Se non trovato, cerca nella famiglia processore
        if (!brand) {
            const famiglia = this.extractSpecValue(specifiche,
                'famiglia processore', 'processor family', 'processore'
            ).toLowerCase();

            if (famiglia.includes('intel')) brand = 'Intel';
            else if (famiglia.includes('amd') || famiglia.includes('ryzen')) brand = 'AMD';
            else if (famiglia.includes('apple') || famiglia.includes('m1') || famiglia.includes('m2') || famiglia.includes('m3')) brand = 'Apple';
            else if (famiglia.includes('qualcomm') || famiglia.includes('snapdragon')) brand = 'Qualcomm';
        }

        return brand || '';
    }

    /**
     * Estrae dimensioni schermo
     */
    private static extractScreenSize(specifiche: any): string {
        const size = this.extractSpecValue(specifiche,
            'dimensioni diagonale schermo', 'display diagonal', 'screen size', 'diagonal'
        );

        return size || '';
    }

    /**
     * Estrae modello completo CPU
     */
    private static extractCPU(specifiche: any): string {
        // Prima cerca famiglia/modello processore
        let cpu = this.extractSpecValue(specifiche,
            'famiglia processore', 'processor family', 'modello del processore', 'processor model'
        );

        // Se non trovato, cerca la combinazione produttore + modello
        if (!cpu) {
            const produttore = this.extractSpecValue(specifiche,
                'produttore processore', 'processor manufacturer'
            );
            const modello = this.extractSpecValue(specifiche,
                'modello del processore', 'processor model', 'processore'
            );

            if (produttore && modello) {
                cpu = `${produttore} ${modello}`;
            } else if (modello) {
                cpu = modello;
            }
        }

        return cpu || '';
    }

    /**
     * Genera descrizione completa del display
     */
    private static generateDisplayDescription(specifiche: any): string {
        const parts: string[] = [];

        // Dimensione schermo
        const size = this.extractSpecValue(specifiche,
            'dimensioni diagonale schermo', 'display diagonal', 'screen size'
        );
        if (size) {
            // Estrai solo i pollici se nel formato "39,6 cm (15.6")"
            const inchMatch = size.match(/\((\d+\.?\d*)[\"']/);
            if (inchMatch) {
                parts.push(`${inchMatch[1]}"`);
            } else {
                parts.push(size);
            }
        }

        // Risoluzione
        const resolution = this.extractSpecValue(specifiche,
            'tipologia hd', 'risoluzione del display', 'resolution'
        );
        if (resolution) {
            if (resolution.includes('1920')) {
                parts.push('Full HD');
            } else if (resolution.includes('4K') || resolution.includes('3840')) {
                parts.push('4K UHD');
            } else if (resolution.includes('2560')) {
                parts.push('QHD');
            } else {
                parts.push(resolution);
            }
        }

        // Tipo pannello
        const displayType = this.detectDisplayType(specifiche);
        if (displayType) parts.push(displayType);

        // Touch
        const touch = this.extractSpecValue(specifiche, 'touch screen', 'touchscreen');
        if (touch.toLowerCase() === 'sì' || touch.toLowerCase() === 'yes') {
            parts.push('Touch');
        }

        // Risoluzione esatta
        const exactRes = this.extractSpecValue(specifiche, 'risoluzione del display', 'display resolution');
        if (exactRes && !parts.some(p => p.includes('x'))) {
            parts.push(exactRes);
        }

        return parts.join(' ') || '';
    }

    /**
     * Genera tabella HTML delle specifiche
     */
    private static generateSpecsTable(specifiche: any): string {
        if (!specifiche || !Array.isArray(specifiche) || specifiche.length === 0) {
            return '';
        }

        let html = '<table class="specs-table" style="width:100%; border-collapse:collapse; font-family:Arial,sans-serif;">\n';
        html += '  <thead>\n';
        html += '    <tr style="background-color:#f8f9fa;">\n';
        html += '      <th style="padding:12px; text-align:left; border:1px solid #dee2e6; font-weight:600;">Caratteristica</th>\n';
        html += '      <th style="padding:12px; text-align:left; border:1px solid #dee2e6; font-weight:600;">Valore</th>\n';
        html += '    </tr>\n';
        html += '  </thead>\n';
        html += '  <tbody>\n';

        for (const spec of specifiche) {
            const name = spec.name || '';
            const value = spec.value || '';
            const unit = spec.unit || '';

            if (name && value) {
                html += `    <tr>\n`;
                html += `      <td style="padding:10px; border:1px solid #dee2e6;">${name}</td>\n`;
                html += `      <td style="padding:10px; border:1px solid #dee2e6;">${value}${unit ? ' ' + unit : ''}</td>\n`;
                html += `    </tr>\n`;
            }
        }

        html += '  </tbody>\n';
        html += '</table>';

        return html;
    }

    /**
     * Genera testo promozionale personalizzato
     */
    private static generatePromotionalText(
        marca: string,
        tipoPC: string,
        processore: string,
        ram: string,
        ssd: string,
        gpu?: string,
        display?: string
    ): string {
        // Determina il target e i punti di forza in base alle specs
        const isHighEnd = (ram && parseInt(ram) >= 16) ||
            (ssd && (ssd.includes('1 TB') || ssd.includes('1TB')));
        const isGaming = (gpu && (gpu.includes('RTX') || gpu.includes('GTX') || gpu.includes('GeForce')));
        const isBusiness = tipoPC.toLowerCase().includes('expert') ||
            tipoPC.toLowerCase().includes('business');
        const isUltrabook = (ram && parseInt(ram) <= 8) &&
            (display && display.includes('13'));

        let headline = '';
        let body = '';
        let callToAction = '';

        // Headline personalizzata
        if (isGaming) {
            const headlines = [
                `Potenza gaming senza compromessi con ${marca}!`,
                `Prestazioni grafiche al top per i veri gamer.`,
                `Gaming ad alte prestazioni: ${marca} ${tipoPC}.`
            ];
            headline = headlines[Math.floor(Math.random() * headlines.length)];
        } else if (isBusiness) {
            const headlines = [
                `Progettato per i professionisti: affidabilità ${marca}.`,
                `Produttività senza limiti con ${marca} ${tipoPC}.`,
                `La scelta dei professionisti: ${marca}.`
            ];
            headline = headlines[Math.floor(Math.random() * headlines.length)];
        } else if (isHighEnd) {
            const headlines = [
                `Prestazioni di alto livello per utenti esigenti.`,
                `Il meglio della tecnologia ${marca} a portata di mano.`,
                `Potenza superiore per chi non accetta compromessi.`
            ];
            headline = headlines[Math.floor(Math.random() * headlines.length)];
        } else if (isUltrabook) {
            const headlines = [
                `Leggerezza e portabilità senza rinunciare alla potenza.`,
                `Compatto e performante: perfetto per chi è sempre in movimento.`,
                `Design sottile, prestazioni brillanti.`
            ];
            headline = headlines[Math.floor(Math.random() * headlines.length)];
        } else {
            const headlines = [
                `Affidabilità e prestazioni con ${marca} ${tipoPC}.`,
                `Qualità ${marca}: tecnologia che fa la differenza.`,
                `Il giusto equilibrio tra potenza e convenienza.`
            ];
            headline = headlines[Math.floor(Math.random() * headlines.length)];
        }

        // Body con dettagli tecnici
        const features = [];
        if (processore) {
            if (processore.includes('i7') || processore.includes('Ryzen 7')) {
                features.push(`processore ${processore} di ultima generazione per prestazioni fulminee`);
            } else if (processore.includes('i5') || processore.includes('Ryzen 5')) {
                features.push(`processore ${processore} per un perfetto equilibrio tra potenza ed efficienza`);
            } else {
                features.push(`processore ${processore} per le tue attività quotidiane`);
            }
        }

        if (ram) {
            const ramNum = parseInt(ram);
            if (ramNum >= 32) {
                features.push(`ben ${ram} di RAM per multitasking estremo`);
            } else if (ramNum >= 16) {
                features.push(`${ram} di RAM per multitasking fluido`);
            } else {
                features.push(`${ram} di RAM`);
            }
        }

        if (ssd) {
            if (ssd.includes('1 TB') || ssd.includes('1TB')) {
                features.push(`ampio SSD da ${ssd} per archiviare tutti i tuoi file`);
            } else if (ssd.includes('512')) {
                features.push(`veloce SSD da ${ssd} per avvii rapidi`);
            } else {
                features.push(`SSD da ${ssd}`);
            }
        }

        if (gpu && !gpu.includes('Integrat')) {
            features.push(`scheda grafica ${gpu} per gaming e creatività`);
        }

        if (features.length > 0) {
            body = `Dotato di ${features.join(', ')}.`;
        }

        // Call to action
        const ctas = [
            'Ordina ora e ricevi spedizione veloce!',
            'Disponibilità immediata. Acquista oggi!',
            'Non perdere questa occasione!',
            'Ideale per lavoro, studio e tempo libero.'
        ];
        callToAction = ctas[Math.floor(Math.random() * ctas.length)];

        return `${headline} ${body} ${callToAction}`.trim();
    }

    /**
     * Estrae URL PDF dai documenti Icecat
     */
    private static extractPDFUrl(documenti: any): string {
        if (!documenti || !Array.isArray(documenti)) return '';

        for (const doc of documenti) {
            if (doc.url && (doc.type === 'manual' || doc.type === 'pdf' || doc.url.toLowerCase().endsWith('.pdf'))) {
                return doc.url;
            }
        }

        return '';
    }

    /**
     * Genera lista HTML dei bullet points
     */
    private static generateBulletPointsHtml(bulletPoints: string[]): string {
        if (!bulletPoints || bulletPoints.length === 0) return '';

        let html = '<ul class="features-list" style="margin-bottom: 20px;">\n';
        for (const point of bulletPoints) {
            html += `  <li>${point}</li>\n`;
        }
        html += '</ul>';
        return html;
    }

    /**
     * Normalizza un tag in Title Case (prima lettera maiuscola, resto minuscolo)
     * Gestisce anche tag con più parole
     */
    private static normalizeTag(tag: string): string {
        if (!tag) return '';
        return tag
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .trim();
    }

    /**
     * Aggiunge un tag normalizzato al Set, evitando duplicati con case diverso
     */
    private static addNormalizedTag(tagSet: Set<string>, tag: string): void {
        if (!tag) return;
        const normalized = this.normalizeTag(tag);
        if (normalized) {
            tagSet.add(normalized);
        }
    }

    /**
     * Genera tags ottimizzati in base alla categoria del prodotto
     * Tutti i tag sono normalizzati in Title Case per evitare duplicati
     */
    private static generateTags(
        product: any,
        specifiche: any,
        marca: string,
        tipoPC: string,
        processore: string,
        ram: string,
        ssd: string,
        gpu: string
    ): string {
        const tagSet = new Set<string>();
        const categoria = product.categoria?.nome?.toLowerCase() || '';
        const nomeProdotto = product.nomeProdotto?.toLowerCase() || '';
        const tipoPCLower = tipoPC.toLowerCase();

        // 1. TAG BASE (Sempre presenti) - Normalizzati
        this.addNormalizedTag(tagSet, marca);
        this.addNormalizedTag(tagSet, product.categoria?.nome);

        // 2. LOGICA PER CATEGORIA

        // --- NOTEBOOK / PORTATILI ---
        const isNotebook = tipoPCLower.includes('notebook') ||
            tipoPCLower.includes('portatile') ||
            tipoPCLower.includes('laptop') ||
            categoria.includes('notebook');

        if (isNotebook) {
            this.addNormalizedTag(tagSet, 'Notebook');
            this.addNormalizedTag(tagSet, 'Portatile');
            this.addNormalizedTag(tagSet, 'Laptop');

            // Specs Notebook
            if (processore) this.addNormalizedTag(tagSet, processore);
            if (ram) this.addNormalizedTag(tagSet, `${ram} RAM`);
            if (ssd) this.addNormalizedTag(tagSet, `${ssd} SSD`);

            // Display
            const screenSize = this.detectMonitorSize(specifiche);
            if (screenSize) this.addNormalizedTag(tagSet, screenSize.replace('"', ' Pollici'));

            // Uso
            if (nomeProdotto.includes('gaming') || gpu?.includes('RTX') || gpu?.includes('GTX')) {
                this.addNormalizedTag(tagSet, 'Gaming');
            }
            if (nomeProdotto.includes('expert') || nomeProdotto.includes('pro') || nomeProdotto.includes('business')) {
                this.addNormalizedTag(tagSet, 'Business');
                this.addNormalizedTag(tagSet, 'Lavoro');
            }
        }

        // --- MONITOR ---
        else if (categoria.includes('monitor') || categoria.includes('display') || tipoPCLower.includes('monitor')) {
            this.addNormalizedTag(tagSet, 'Monitor');
            this.addNormalizedTag(tagSet, 'Display');

            const screenSize = this.detectMonitorSize(specifiche);
            if (screenSize) this.addNormalizedTag(tagSet, screenSize);

            const resolution = this.detectResolution(specifiche);
            if (resolution) this.addNormalizedTag(tagSet, resolution);

            if (nomeProdotto.includes('gaming') || nomeProdotto.includes('tuf') || nomeProdotto.includes('rog')) {
                this.addNormalizedTag(tagSet, 'Gaming Monitor');
            }
        }

        // --- COMPONENTI PC (Case, Motherboard, GPU, etc.) ---
        else if (categoria.includes('componenti') || categoria.includes('case') || categoria.includes('schede madri')) {
            this.addNormalizedTag(tagSet, 'Componenti Pc');

            if (categoria.includes('case') || nomeProdotto.includes('tower') || nomeProdotto.includes('chassis')) {
                this.addNormalizedTag(tagSet, 'Case');
                this.addNormalizedTag(tagSet, 'Cabinet');
                if (nomeProdotto.includes('atx')) this.addNormalizedTag(tagSet, 'Atx');
                if (nomeProdotto.includes('itx')) this.addNormalizedTag(tagSet, 'Mini-itx');
            }

            if (categoria.includes('schede video') || nomeProdotto.includes('rtx') || nomeProdotto.includes('gtx') || nomeProdotto.includes('radeon')) {
                this.addNormalizedTag(tagSet, 'Scheda Video');
                this.addNormalizedTag(tagSet, 'Gpu');
            }
        }

        // --- ACCESSORI / PERIFERICHE ---
        else if (categoria.includes('accessori') || categoria.includes('mouse') || categoria.includes('tastiere')) {
            this.addNormalizedTag(tagSet, 'Accessori');
            this.addNormalizedTag(tagSet, 'Periferiche');
        }

        // 3. TAG TRASVERSALI (se rilevanti)

        // Gaming (trasversale)
        if (nomeProdotto.includes('gaming') || nomeProdotto.includes('rog') || nomeProdotto.includes('tuf')) {
            this.addNormalizedTag(tagSet, 'Gaming');
        }

        return Array.from(tagSet).join(', ');
    }

    /**
     * Genera introduzione del prodotto (50-80 parole)
     */
    private static generateIntroduction(
        marca: string,
        nomeProdotto: string,
        categoria: string,
        tipoPC: string,
        processore: string,
        ram: string,
        ssd: string,
        descrizioneBraveIcecat?: string
    ): string {
        // Determina il target e il beneficio principale
        const catLower = categoria.toLowerCase();
        const prodLower = nomeProdotto.toLowerCase();

        let target = 'professionisti e appassionati di tecnologia';
        let beneficioPrincipale = 'prestazioni affidabili';
        let caratteristicaDistintiva = '';

        // Determina target basato su categoria e tipo
        if (prodLower.includes('gaming') || prodLower.includes('rog')) {
            target = 'gamer e content creator';
            beneficioPrincipale = 'potenza grafica e prestazioni elevate';
        } else if (prodLower.includes('expert') || prodLower.includes('business') || prodLower.includes('thinkpad')) {
            target = 'professionisti e aziende';
            beneficioPrincipale = 'affidabilità e sicurezza';
        } else if (prodLower.includes('ultrabook') || prodLower.includes('zenbook')) {
            target = 'professionisti in mobilità';
            beneficioPrincipale = 'portabilità estrema senza compromessi';
        } else if (catLower.includes('notebook')) {
            target = 'studenti, professionisti e utenti everyday';
            beneficioPrincipale = 'versatilità e praticità';
        } else if (catLower.includes('monitor')) {
            target = 'professionisti creativi e gamer';
            beneficioPrincipale = 'qualità visiva superiore';
        }

        // Caratteristica distintiva
        if (processore && processore.includes('i7')) {
            caratteristicaDistintiva = `il potente processore ${processore} `;
        } else if (processore && processore.includes('i9')) {
            caratteristicaDistintiva = `l'eccezionale processore ${processore} di ultima generazione`;
        } else if (processore && processore.includes('Ryzen 7')) {
            caratteristicaDistintiva = `il performante ${processore}`;
        } else if (ram && parseInt(ram) >= 16) {
            caratteristicaDistintiva = `${ram} di RAM per multitasking intenso`;
        } else if (ssd && ssd.includes('1 TB')) {
            caratteristicaDistintiva = `ampio storage da ${ssd}`;
        }

        const productName = descrizioneBraveIcecat
            ? descrizioneBraveIcecat.split(',')[0]
            : `${marca} ${categoria}`;

        return `Il <strong>${productName}</strong> è ${beneficioPrincipale === 'potenza grafica e prestazioni elevate' ? 'la soluzione ideale' : 'il notebook perfetto'} per ${target} che cercano ${beneficioPrincipale}. ${caratteristicaDistintiva ? `Dotato di ${caratteristicaDistintiva}, ` : ''}garantisce prestazioni fluide in ogni scenario d'uso. Un compagno affidabile per lavoro, studio e intrattenimento.`;
    }

    /**
     * Genera sezioni caratteristiche del prodotto
     */
    private static generateFeatureSections(
        categoria: string,
        tipoPC: string,
        specifiche: any,
        processore: string,
        ram: string,
        ssd: string,
        gpu: string,
        displayDesc: string,
        os: string
    ): string {
        let html = '';
        const catLower = categoria.toLowerCase();
        const isNotebook = tipoPC !== '';
        const isMonitor = catLower.includes('monitor');

        // SEZIONE 1: PRESTAZIONI (per notebook/PC)
        if (isNotebook && processore) {
            html += '\u003cdiv class="feature-section" style="margin-bottom: 20px;"\u003e\n';
            html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 10px;"\u003ePrestazioni fluide per ogni attività\u003c/h3\u003e\n';
            html += '  \u003cp\u003e';

            if (processore.includes('i7') || processore.includes('Ryzen 7')) {
                html += `Il processore ${processore} garantisce velocità eccezionale in multitasking, editing video e applicazioni professionali. `;
            } else if (processore.includes('i5') || processore.includes('Ryzen 5')) {
                html += `Il processore ${processore} offre il perfetto equilibrio tra prestazioni ed efficienza energetica per utilizzo quotidiano. `;
            } else {
                html += `Dotato di processore ${processore}, assicura reattività in ogni situazione. `;
            }

            if (ram) {
                const ramNum = parseInt(ram);
                if (ramNum >= 16) {
                    html += `Con ${ram} di RAM, gestisci senza problemi decine di schede browser, suite Office e software professionali simultaneamente. `;
                } else if (ramNum >= 8) {
                    html += `${ram} di RAM garantiscono multitasking fluido per navigazione, produttività e streaming. `;
                } else {
                    html += `${ram} di RAM per le attività quotidiane. `;
                }
            }

            if (ssd) {
                html += `L'SSD da ${ssd} offre velocità di lettura/scrittura fulminee e spazio abbondante per documenti, progetti e file multimediali.`;
            }

            html += '\u003c/p\u003e\n\u003c/div\u003e\n';
        }

        // SEZIONE 2: DISPLAY (per notebook/monitor)
        if ((isNotebook || isMonitor) && displayDesc) {
            html += '\u003cdiv class="feature-section" style="margin-bottom: 20px;"\u003e\n';
            html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 10px;"\u003eDisplay nitido per lavorare ovunque\u003c/h3\u003e\n';
            html += '  \u003cp\u003e';

            const displaySize = this.extractSpecValue(specifiche, 'display diagonal', 'dimensioni schermo');
            const resolution = this.detectResolution(specifiche);

            if (displaySize && resolution) {
                if (resolution.includes('Full HD') || resolution.includes('1920')) {
                    html += `Lo schermo da ${displaySize} Full HD (1920x1080) offre immagini nitide e colori vividi. `;
                } else if (resolution.includes('4K')) {
                    html += `Il display da ${displaySize} in risoluzione 4K UHD regala dettagli straordinari e colori accurati. `;
                } else if (resolution.includes('QHD')) {
                    html += `Il pannello da ${displaySize} QHD garantisce una qualità visiva superiore per lavoro e intrattenimento. `;
                }
            }

            const displayType = this.detectDisplayType(specifiche);
            if (displayType === 'IPS') {
                html += 'La tecnologia IPS assicura angoli di visione ampi e riproduzione cromatica fedele. ';
            }

            html += 'Perfetto per editing foto, visione di contenuti multimediali e lunghe sessioni di lavoro senza affaticamento visivo.';
            html += '\u003c/p\u003e\n\u003c/div\u003e\n';
        }

        // SEZIONE 3: PORTABILITÀ (per notebook)
        if (isNotebook) {
            html += '\u003cdiv class="feature-section" style="margin-bottom: 20px;"\u003e\n';
            html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 10px;"\u003eProgettato per la mobilità\u003c/h3\u003e\n';
            html += '  \u003cp\u003e';

            const weight = this.extractSpecValue(specifiche, 'peso', 'weight');
            if (weight && parseFloat(weight) < 2) {
                html += `Con soli ${weight} di peso, si trasporta facilmente ovunque. `;
            } else if (weight) {
                html += `Peso contenuto di ${weight} per comodità di trasporto. `;
            } else {
                html += 'Design compatto e leggero per chi lavora in movimento. ';
            }

            const battery = this.extractSpecValue(specifiche, 'capacità della batteria', 'battery capacity');
            if (battery) {
                html += `La batteria garantisce autonomia per l'intera giornata lavorativa, liberandoti dalla ricerca costante di prese elettriche. `;
            }

            html += 'Perfetto per professionisti in smart working, studenti universitari e chi lavora tra ufficio, casa e coworking.';
            html += '\u003c/p\u003e\n\u003c/div\u003e\n';
        }

        // SEZIONE 4: CONNETTIVITÀ
        html += '\u003cdiv class="feature-section" style="margin-bottom: 20px;"\u003e\n';
        html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 10px;"\u003eConnettività completa e moderna\u003c/h3\u003e\n';
        html += '  \u003cp\u003e';

        const wifi = this.extractSpecValue(specifiche, 'standard wi-fi', 'wi-fi standard');
        if (wifi && wifi.includes('6')) {
            html += 'WiFi 6 per connessioni internet velocissime e stabili anche in ambienti affollati. ';
        } else if (wifi) {
            html += 'Connettività WiFi affidabile per navigazione e streaming. ';
        }

        const bluetooth = this.extractSpecValue(specifiche, 'versione bluetooth', 'bluetooth version');
        if (bluetooth) {
            html += `Bluetooth ${bluetooth} per collegare cuffie, mouse e altri dispositivi wireless. `;
        }

        html += 'Dotazione completa di porte USB, HDMI e jack audio per massima versatilità.';
        html += '\u003c/p\u003e\n\u003c/div\u003e\n';

        // SEZIONE 5: GRAFICA/GPU (se rilevante)
        if (gpu && !gpu.includes('Integrat')) {
            html += '\u003cdiv class="feature-section" style="margin-bottom: 20px;"\u003e\n';
            html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 10px;"\u003eGrafica dedicata per gaming e creatività\u003c/h3\u003e\n';
            html += '  \u003cp\u003e';
            html += `La scheda grafica ${gpu} porta le tue sessioni di gaming e progetti creativi a un livello superiore. `;
            html += 'Ideale per gaming in Full HD, editing video, rendering 3D e applicazioni grafiche professionali.';
            html += '\u003c/p\u003e\n\u003c/div\u003e\n';
        }

        return html;
    }

    /**
     * Genera lista specifiche tecniche complete
     */
    private static generateDetailedSpecs(
        specifiche: any,
        processore: string,
        ram: string,
        ssd: string,
        gpu: string,
        os: string,
        marca: string,
        categoria: string
    ): string {
        let html = '\u003cdiv class="specs-section" style="margin-bottom: 25px;"\u003e\n';
        html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 15px;"\u003eSpecifiche Tecniche\u003c/h3\u003e\n';
        html += '  \u003cul style="list-style: none; padding-left: 0;"\u003e\n';

        const catLower = categoria.toLowerCase();
        const isNotebook = catLower.includes('notebook') || catLower.includes('laptop');

        if (isNotebook) {
            // Specifiche Notebook
            if (processore) {
                html += `    \u003cli\u003e\u003cstrong\u003eProcessore:\u003c/strong\u003e ${processore}\u003c/li\u003e\n`;
            }

            if (ram) {
                const ramType = this.extractSpecValue(specifiche, 'tipo di ram interna', 'internal memory type');
                html += `    \u003cli\u003e\u003cstrong\u003eRAM:\u003c/strong\u003e ${ram}${ramType ? ' ' + ramType : ''}\u003c/li\u003e\n`;
            }

            if (ssd) {
                const storageType = this.extractSpecValue(specifiche, 'tipo di unità di archiviazione', 'storage drive type');
                html += `    \u003cli\u003e\u003cstrong\u003eStorage:\u003c/strong\u003e ${ssd}${storageType ? ' ' + storageType : ''}\u003c/li\u003e\n`;
            }

            if (gpu) {
                html += `    \u003cli\u003e\u003cstrong\u003eScheda Grafica:\u003c/strong\u003e ${gpu}\u003c/li\u003e\n`;
            }

            const displaySize = this.extractSpecValue(specifiche, 'display diagonal', 'dimensioni schermo');
            const resolution = this.detectResolution(specifiche);
            if (displaySize) {
                html += `    \u003cli\u003e\u003cstrong\u003eDisplay:\u003c/strong\u003e ${displaySize}${resolution ? ', ' + resolution : ''}\u003c/li\u003e\n`;
            }

            if (os) {
                html += `    \u003cli\u003e\u003cstrong\u003eSistema Operativo:\u003c/strong\u003e ${os}\u003c/li\u003e\n`;
            }

            const wifi = this.extractSpecValue(specifiche, 'standard wi-fi', 'wi-fi standard');
            if (wifi) {
                html += `    \u003cli\u003e\u003cstrong\u003eConnettività:\u003c/strong\u003e WiFi ${wifi}, Bluetooth\u003c/li\u003e\n`;
            }

            const weight = this.extractSpecValue(specifiche, 'peso', 'weight');
            if (weight) {
                html += `    \u003cli\u003e\u003cstrong\u003ePeso:\u003c/strong\u003e ${weight}\u003c/li\u003e\n`;
            }

            const battery = this.extractSpecValue(specifiche, 'capacità della batteria', 'battery capacity');
            if (battery) {
                html += `    \u003cli\u003e\u003cstrong\u003eBatteria:\u003c/strong\u003e ${battery}\u003c/li\u003e\n`;
            }
        } else {
            // Specifiche generiche per altri prodotti
            if (Array.isArray(specifiche) && specifiche.length > 0) {
                const topSpecs = specifiche.slice(0, 10);
                for (const spec of topSpecs) {
                    const name = spec.name || '';
                    const value = spec.value || '';
                    const unit = spec.unit || '';

                    if (name && value) {
                        html += `    \u003cli\u003e\u003cstrong\u003e${name}:\u003c/strong\u003e ${value}${unit ? ' ' + unit : ''}\u003c/li\u003e\n`;
                    }
                }
            }
        }

        html += '  \u003c/ul\u003e\n\u003c/div\u003e\n';
        return html;
    }

    /**
     * Genera sezione target utente
     */
    private static generateTargetSection(categoria: string, tipoPC: string, nomeProdotto: string): string {
        const catLower = categoria.toLowerCase();
        const prodLower = nomeProdotto.toLowerCase();

        let targets: string[] = [];

        if (prodLower.includes('gaming') || prodLower.includes('rog')) {
            targets = ['Gamer appassionati', 'Content creator e streamer', 'Editing video e rendering 3D', 'Gaming competitivo'];
        } else if (prodLower.includes('expert') || prodLower.includes('business')) {
            targets = ['Professionisti e aziende', 'Smart working e lavoro ibrido', 'Piccole e medie imprese', 'Freelance e liberi professionisti'];
        } else if (catLower.includes('notebook')) {
            targets = ['Studenti universitari', 'Professionisti in mobilità', 'Uso ufficio e produttività', 'Navigazione web e streaming'];
        } else if (catLower.includes('monitor')) {
            targets = ['Designer e grafici', 'Fotografi e video editor', 'Gaming e multimedia', 'Produttività multi-monitor'];
        } else {
            targets = ['Utenti everydayBusiness e professionisti', 'Studio e lavoro', 'Intrattenimento multimediale'];
        }

        let html = '\u003cdiv class="target-section" style="margin-bottom: 25px; background-color: #f8f9fa; padding: 15px; border-radius: 8px;"\u003e\n';
        html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 10px;"\u003eIdeale per\u003c/h3\u003e\n';
        html += '  \u003cp\u003e' + targets.join(' • ') + '\u003c/p\u003e\n';
        html += '\u003c/div\u003e\n';

        return html;
    }

    /**
     * Genera la descrizione HTML completa per Shopify seguendo le best practice SEO
     */
    private static generateFullHtmlDescription(
        descrizione: string,
        bulletPoints: string[],
        specsTable: string,
        promotionalText: string,
        marca: string,
        nomeProdotto: string,
        categoria: string,
        specifiche: any,
        tipoPC: string,
        processore: string,
        ram: string,
        ssd: string,
        gpu: string,
        displayDesc: string,
        os: string,
        descrizioneBraveIcecat?: string
    ): string {
        let html = '\u003cdiv class="product-description" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"\u003e\n';

        // A. INTRODUZIONE
        html += '\u003cdiv class="intro-section" style="margin-bottom: 30px;"\u003e\n';
        const intro = this.generateIntroduction(marca, nomeProdotto, categoria, tipoPC, processore, ram, ssd, descrizioneBraveIcecat);
        html += `  \u003cp style="font-size: 16px; line-height: 1.8;"\u003e${intro}\u003c/p\u003e\n`;
        html += '\u003c/div\u003e\n';

        // B. SEZIONI CARATTERISTICHE
        html += this.generateFeatureSections(categoria, tipoPC, specifiche, processore, ram, ssd, gpu, displayDesc, os);

        // C. SPECIFICHE TECNICHE COMPLETE
        html += this.generateDetailedSpecs(specifiche, processore, ram, ssd, gpu, os, marca, categoria);

        // D. BULLET POINTS (se disponibili da Icecat)
        if (bulletPoints && bulletPoints.length > 0) {
            html += '\u003cdiv class="highlights-section" style="margin-bottom: 25px;"\u003e\n';
            html += '  \u003ch3 style="color: #2c3e50; font-size: 18px; margin-bottom: 10px;"\u003ePunti di Forza\u003c/h3\u003e\n';
            html += this.generateBulletPointsHtml(bulletPoints);
            html += '\u003c/div\u003e\n';
        }

        // E. TARGET / IDEALE PER
        html += this.generateTargetSection(categoria, tipoPC, nomeProdotto);

        // F. GARANZIA
        html += '\u003cdiv class="warranty-section" style="margin-bottom: 20px; padding: 15px; background-color: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 4px;"\u003e\n';
        html += '  \u003cp style="margin: 0;"\u003e\u003cstrong\u003eGaranzia:\u003c/strong\u003e 24 mesi Italia con supporto tecnico ufficiale\u003c/p\u003e\n';
        html += '  \u003cp style="margin: 5px 0 0 0;"\u003e\u003cstrong\u003eSpedizione:\u003c/strong\u003e Veloce e sicura con corriere tracciato\u003c/p\u003e\n';
        html += '\u003c/div\u003e\n';

        html += '\u003c/div\u003e';
        return html;
    }

    /**
     * Estrae dettagli processore (es. Intel i5, Ryzen 7)
     */
    private static extractProcessorDetail(specifiche: any): string {
        const family = this.extractSpecValue(specifiche, 'processor family', 'famiglia processore').toLowerCase();
        const model = this.extractSpecValue(specifiche, 'processor model', 'modello del processore').toLowerCase();
        const combined = `${family} ${model}`;

        if (combined.includes('i9')) return 'Intel Core i9';
        if (combined.includes('i7')) return 'Intel Core i7';
        if (combined.includes('i5')) return 'Intel Core i5';
        if (combined.includes('i3')) return 'Intel Core i3';
        if (combined.includes('ryzen 9')) return 'AMD Ryzen 9';
        if (combined.includes('ryzen 7')) return 'AMD Ryzen 7';
        if (combined.includes('ryzen 5')) return 'AMD Ryzen 5';
        if (combined.includes('ryzen 3')) return 'AMD Ryzen 3';
        if (combined.includes('m1')) return 'Apple M1';
        if (combined.includes('m2')) return 'Apple M2';
        if (combined.includes('m3')) return 'Apple M3';
        if (combined.includes('celeron')) return 'Intel Celeron';
        if (combined.includes('pentium')) return 'Intel Pentium';
        if (combined.includes('athlon')) return 'AMD Athlon';

        return this.extractProcessorBrand(specifiche); // Fallback al brand
    }

    /**
     * Genera titolo ottimizzato SEO
     * Formato: [BRAND] [MODELLO] - [PROCESSORE], [RAM], [STORAGE], [DISPLAY], [OS]
     * Esempio: Lenovo ThinkPad P16 Gen 2 - Intel Core i9, 32 GB RAM, SSD 1 TB, Display 16", Windows 11 Pro
     * 
     * La descrizioneBrave di Icecat è già strutturata nel formato:
    /**
     * Pulisce HTML e caratteri speciali da una stringa
     */
    private static cleanText(input: string): string {
        if (!input) return '';
        return input
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&trade;/gi, '')
            .replace(/&reg;/gi, '')
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&egrave;/g, 'è')
            .replace(/&agrave;/g, 'à')
            .replace(/®/g, '')
            .replace(/™/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Arricchisce il titolo estraendo specifiche dal nome prodotto quando i dati Icecat sono incompleti
     * Usa pattern regex intelligenti per identificare CPU, RAM, SSD, Display
     */
    /**
     * REGOLA STANDARD: Arricchimento titolo universale
     * Pulisce HTML, estrae specifiche moderne (2024+) e costruisce titoli coerenti.
     */
    private static enrichTitleFromProductName(
        ean: string,
        marca: string,
        nomeProdotto: string,
        categoria: string
    ): string {
        try {
            // 1. PULIZIA UNIFICATA STANDARD
            // Rimuove HTML, entità, e doppi spazi. Trasforma tutto in testo piano pulito.
            let cleanName = ShopifyExportService.cleanText(nomeProdotto);

            // Se stripHtml ritorna vuoto (caso estremo), usa il nome raw
            if (!cleanName || cleanName.length < 5) cleanName = nomeProdotto;

            const textUpper = cleanName.toUpperCase();
            const specs: string[] = [];
            const debugSpecs: string[] = []; // Per log interno

            // 2. ESTRAZIONE PROCESSORE (STANDARD 2025)
            // Supporta: Intel Core Ultra, Intel Core iX, iX-XXXX, AMD Ryzen X, Ryzen X XXXX
            const cpuRegex = /(?:INTEL|AMD)?\s*(?:CORE\s+|RYZEN\s+)?(?:ULTRA\s+)?([3579]|I[3579])(?:[-\s]+)(\d{3,5}[A-Z]*|ULTRA\s+\d+|PRO\s+\d+)/i;
            const cpuMatch = textUpper.match(cpuRegex);

            if (cpuMatch) {
                // Formatta in modo pulito: "Intel Core Ultra 9" o "Ryzen 5 7535HS"
                let cpuRaw = cpuMatch[0].replace(/\s+/g, ' ').trim();
                // Normalizza brand
                if (cpuRaw.includes('RYZEN')) cpuRaw = 'Ryzen ' + cpuRaw.replace(/(AMD|RYZEN)\s*/g, '');
                else if (cpuRaw.includes('ULTRA')) cpuRaw = 'Intel Ultra ' + cpuRaw.replace(/(INTEL|CORE|ULTRA)\s*/g, '');
                else cpuRaw = 'Intel ' + cpuRaw.replace(/(INTEL|CORE)\s*/g, '').replace('I', 'i'); // i7 13650

                specs.push(cpuRaw);
                debugSpecs.push('CPU');
            }

            // 3. ESTRAZIONE RAM (STANDARD)
            // Cerca "16GB", "16 GB", "32GB RAM"
            const ramMatch = textUpper.match(/(\d+)\s*(?:GB|GIGABYTES)\s*(?:RAM|MEMORY|DDR[45])?/i);
            if (ramMatch) {
                specs.push(`${ramMatch[1]}GB RAM`);
                debugSpecs.push('RAM');
            }

            // 4. ESTRAZIONE STORAGE (STANDARD)
            // Priorità a SSD. Cerca "512GB SSD", "1TB SSD", "SSD 512"
            const ssdMatch = textUpper.match(/(?:SSD\s*)?(\d+)\s*(GB|TB)(?:\s*SSD|\s*NVME)?/i);
            if (ssdMatch) {
                // Verifica che non sia la RAM duplicata (es. 16GB RAM ... 16GB)
                const val = ssdMatch[1] + ssdMatch[2];
                if (!specs.some(s => s.includes(val + ' RAM'))) {
                    specs.push(`SSD ${val}`);
                    debugSpecs.push('SSD');
                }
            }

            // 5. ESTRAZIONE DISPLAY (STANDARD)
            // Pattern: 16", 15.6", 16-inch
            const displayMatch = textUpper.match(/(\d{2}[.,]\d?)\s*(?:\"|''|POLLICI|INCH)/i);
            if (displayMatch) {
                specs.push(`Display ${displayMatch[1].replace(',', '.')}"`);
                debugSpecs.push('DISPLAY');
            }

            // 6. ESTRAZIONE GPU (NUOVO STANDARD GAMING)
            // Cerca RTX 40xx, 30xx, etc.
            const gpuMatch = textUpper.match(/(RTX\s*\d{4}[A-Z]*|GTX\s*\d{4}[A-Z]*|RADEON\s*RX\s*\d{4})/i);
            if (gpuMatch) {
                let gpu = gpuMatch[1].replace(/\s+/g, ' ');
                if (!gpu.includes('NVIDIA') && gpu.includes('RTX')) gpu = 'NVIDIA ' + gpu;
                specs.push(gpu);
                debugSpecs.push('GPU');
            }

            // === COSTRUZIONE TITOLO STANDARD ===
            // Condizione: Almeno 2 specifiche trovate per considerare il titolo "VALIDO" tramite parsing
            if (specs.length >= 2) {
                // Tenta di estrarre un "Modello" dal nome pulito
                // Prendi le prime parole che NON sono Marca, e che NON sono specifiche tecniche
                let cleanWords = cleanName
                    .replace(new RegExp(marca, 'gi'), '') // Via la marca
                    .replace(/NoteBook|Laptop|Computer/gi, '') // Via la categoria generica
                    .replace(/<[^>]+>/g, '') // Sicurezza extra
                    .replace(new RegExp(specs.join('|').replace(/\s/g, '|'), 'gi'), '') // Via le specs trovate
                    .replace(/[^\w\s\-\.]/g, '') // Via caratteri strani
                    .trim()
                    .split(/\s+/);

                // Prendi prime 2-3 parole significative come "Modello"
                let modello = '';
                let count = 0;
                for (const w of cleanWords) {
                    if (w.length > 2 && count < 3 && !/^\d+GB$/i.test(w)) {
                        modello += w + ' ';
                        count++;
                    }
                }
                modello = modello.trim();
                if (modello.length < 3) modello = categoria; // Fallback

                const finalTitle = `${marca} ${modello} ${categoria === 'NOTEBOOK' ? 'Notebook' : categoria} - ${specs.join(', ')}`;
                logger.info(`✅ [STANDARD] Titolo generato (${debugSpecs.join('+')}): ${finalTitle}`);
                return finalTitle.substring(0, 150);
            }

            logger.warn(`⚠️ [STANDARD] Specifiche insufficienti (${specs.length}) nel nome per ${ean}`);
            return ''; // Ritorna vuoto per attivare Web Search o AI fallback

        } catch (error: any) {
            logger.error(`Errore parsing standard per ${ean}:`, error.message);
            return '';
        }
    }

    /**
     * Cerca specifiche sul web usando DuckDuckGo HTML
     */
    private static async searchSpecsOnWeb(ean: string, marca: string, nomeProdotto: string): Promise<string[]> {
        try {
            const axios = require('axios');
            const cheerio = require('cheerio');

            // Query semplificata: EAN + Brand + "specs"
            const query = encodeURIComponent(`${ean} ${marca} specs`);
            const url = `https://html.duckduckgo.com/html/?q=${query}`;

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 4000
            });

            const $ = cheerio.load(response.data);
            const text = $('body').text().replace(/\s+/g, ' ').toUpperCase();

            const specs: string[] = [];

            // CPU
            const cpuMatches = [
                /INTEL\s+(?:CORE\s+)?(I[3579])[- ]?(\d{4,5}[A-Z]?)/i,
                /(?:AMD\s+)?RYZEN\s+([3579])[- ]?(\d{4}[A-Z]?)/i
            ];
            for (const re of cpuMatches) {
                const m = text.match(re);
                if (m) {
                    specs.push(m[0].replace('INTEL', 'Intel').replace('RYZEN', 'Ryzen').replace('CORE', ''));
                    break;
                }
            }

            // RAM
            const ramMatch = text.match(/(\d+)\s*GB\s*(?:RAM|DDR[45]|MEMORY)/i);
            if (ramMatch) specs.push(`${ramMatch[1]}GB RAM`);

            // SSD
            const ssdMatch = text.match(/(\d+)\s*(?:GB|TB)\s*(?:SSD|NVME|STORAGE)/i);
            if (ssdMatch && (ssdMatch[0].includes('TB') || parseInt(ssdMatch[1]) > 64)) {
                specs.push(`SSD ${ssdMatch[1]}${ssdMatch[0].includes('TB') ? 'TB' : 'GB'}`);
            }

            return [...new Set(specs)];

        } catch (error) {
            return [];
        }
    }

    /**
     * Genera un titolo ottimizzato SEO seguendo la formula:
     * [BRAND] [MODELLO] [TIPO] - [PROCESSORE], [RAM], [STORAGE], [DISPLAY], [FEATURE DISTINTIVA]
     * 
     * Se le specifiche Icecat sono incomplete, estrae automaticamente le informazioni dal nome prodotto
     * 
     * Lunghezza ideale: 80-120 caratteri (max 150)
     * 
     * Esempio:
     * "ASUS ExpertBook P1 Notebook Professionale - Ryzen 5, 8GB RAM DDR5, SSD 512GB NVMe, 15.6" FHD, Win 11"
     */
    /**
     * Genera titolo ottimizzato SEO
     * NUOVA LOGICA (Step 542):
     * 1. AI (Primary): Usa GPT per generare titolo perfetto da EAN/Nome.
     * 2. Regex Locale (Fallback): Usa parser robusto se AI non disponibile.
     */
    /**
     * Genera titolo ottimizzato SEO
     * NUOVA LOGICA (Dicembre 2025):
     * Usa AITitleService centralizzato per garantire coerenza con le rigenerazioni manuali.
     */
    /**
     * Genera titolo ottimizzato SEO
     * 
     * NOTA: Durante l'export massivo NON chiamiamo l'AI per evitare timeout e costi.
     * Usiamo una logica robusta basata sui dati già presenti (Icecat o Regex).
     * Se l'utente vuole titoli AI, deve eseguire l'azione "Migliora Titoli" prima dell'export.
     */
    private static generateOptimizedTitle(
        marca: string,
        nomeProdotto: string,
        specifiche: any,
        categoria: string,
        descrizioneBraveIcecat?: string,
        ean?: string
    ): string {
        try {
            // 1. Se abbiamo una descrizione breve Icecat valida e pulita, usiamola come base
            // Spesso Icecat ha titoli tipo "Lenovo ThinkPad X1..." che sono ottimi
            if (descrizioneBraveIcecat && descrizioneBraveIcecat.length > 20 && !descrizioneBraveIcecat.toUpperCase().startsWith('NOTEBOOK')) {
                return descrizioneBraveIcecat.substring(0, 150);
            }

            // 2. Logica Regex Locale (Fallback Robusto)
            // Tenta di pulire e strutturare il nome prodotto originale
            let cleanModel = ShopifyExportService.cleanText(nomeProdotto);
            const regexMarca = new RegExp(`^${marca}\\s*`, 'i');
            cleanModel = cleanModel.replace(regexMarca, '').trim();

            // Se il modello sembra "sporco" o troppo lungo, accorcialo
            if (cleanModel.includes('<') || cleanModel.length > 60) {
                const parts = cleanModel.split(/\s+/);
                // Prendi le prime 4-5 parole che potrebbero costituire il modello
                cleanModel = parts.slice(0, 5).join(' ');
            }

            let title = `${marca} ${cleanModel}`;

            // Aggiungi categoria se non presente
            if (categoria && !title.toLowerCase().includes(categoria.toLowerCase())) {
                title += ` ${categoria === 'NOTEBOOK' ? 'Notebook' : categoria}`;
            }

            return title.substring(0, 150);

        } catch (error) {
            logger.warn(`⚠️ [Title] Errore generazione titolo locale per ${ean}: ${error}`);
            return nomeProdotto;
        }
    }

    /**
     * Genera prodotti Shopify da Master File arricchito
     * OTTIMIZZATO: Processa in batch paralleli per performance elevate
     */
    static async generateShopifyExport(): Promise<ShopifyProduct[]> {
        try {
            logger.info('🛍️ Generazione export Shopify (Ottimizzata)...');
            const startTime = Date.now();

            // Carica placeholder dalla configurazione
            const placeholderConfig = await prisma.configurazioneSistema.findUnique({
                where: { chiave: 'shopify_placeholder_image' }
            });
            const CUSTOM_PLACEHOLDER = placeholderConfig?.valore || 'https://i.postimg.cc/mkXhdRKy/help-computer-logo.png';

            // Conta totale per logging
            const totalProducts = await prisma.masterFile.count();
            logger.info(`📦 Totale prodotti da processare: ${totalProducts}`);

            const BATCH_SIZE = 100;
            const shopifyProducts: ShopifyProduct[] = [];
            let processedCount = 0;

            // Paginazione con cursore sarebbe ideale, ma skip/take è ok per <100k prodotti
            for (let skip = 0; skip < totalProducts; skip += BATCH_SIZE) {
                const products = await prisma.masterFile.findMany({
                    skip: skip,
                    take: BATCH_SIZE,
                    include: {
                        marchio: { select: { nome: true } },
                        categoria: { select: { nome: true } },
                        datiIcecat: true
                    }
                });

                // Recupera dati raw e mappature per questo batch
                const eans = products.map(p => p.eanGtin);
                const rawData = await prisma.listinoRaw.findMany({
                    where: { eanGtin: { in: eans } },
                    select: { eanGtin: true, fornitoreId: true, skuFornitore: true, altriCampiJson: true }
                });

                const uniqueSupplierIds = [...new Set(products.map(p => p.fornitoreSelezionatoId))];
                const mappings = await prisma.mappaturaCampo.findMany({
                    where: {
                        fornitoreId: { in: uniqueSupplierIds },
                        campoStandard: 'product_code'
                    }
                });

                // Crea mappe per lookup veloce
                const rawMap = new Map();
                rawData.forEach(r => {
                    const key = `${r.fornitoreId}_${r.skuFornitore}`;
                    rawMap.set(key, r);
                });

                const mappingMap = new Map(mappings.map(m => [m.fornitoreId, m.campoOriginale]));

                // Processa batch in parallelo
                const batchResults = await Promise.all(products.map(async (product) => {
                    try {
                        const fornitoreId = product.fornitoreSelezionatoId;
                        const skuSelezionato = product.skuSelezionato;
                        const rawKey = `${fornitoreId}_${skuSelezionato}`;
                        const rawProduct = rawMap.get(rawKey);

                        let productCode = '';
                        if (rawProduct && rawProduct.altriCampiJson) {
                            const originalRow = JSON.parse(rawProduct.altriCampiJson);
                            const originalKey = mappingMap.get(fornitoreId);
                            if (originalKey && originalRow[originalKey]) {
                                productCode = originalRow[originalKey].toString().trim();
                            }
                        }

                        const specifiche = product.datiIcecat?.specificheTecnicheJson
                            ? JSON.parse(product.datiIcecat.specificheTecnicheJson)
                            : [];

                        const documenti = product.datiIcecat?.documentiJson
                            ? JSON.parse(product.datiIcecat.documentiJson)
                            : [];

                        const immagini = product.datiIcecat?.urlImmaginiJson
                            ? JSON.parse(product.datiIcecat.urlImmaginiJson)
                            : [];

                        // Se non ci sono immagini, usa placeholder dalla configurazione
                        if (immagini.length === 0) {
                            immagini.push(CUSTOM_PLACEHOLDER);
                        }

                        const bulletPoints = product.datiIcecat?.bulletPointsJson
                            ? JSON.parse(product.datiIcecat.bulletPointsJson)
                            : [];

                        const marca = product.marchio?.nome || '';
                        const tipoPC = this.detectPCType(specifiche, product.categoria?.nome || null);
                        const processore = this.extractProcessorBrand(specifiche);
                        const ram = this.extractRAM(specifiche);
                        const ssd = this.extractSSDCapacity(specifiche);
                        const gpu = this.extractGPU(specifiche);
                        const os = this.extractOS(specifiche);
                        const displayDesc = this.generateDisplayDescription(specifiche);

                        const specsTable = this.generateSpecsTable(specifiche);
                        const promotionalText = this.generatePromotionalText(marca, tipoPC, processore, ram, ssd, gpu, displayDesc);

                        let baseDescription = product.datiIcecat?.descrizioneLunga || product.datiIcecat?.descrizioneBrave || '';

                        // Fallback: Se manca descrizione Icecat, usa il nome prodotto originale se contiene specifiche
                        if (!baseDescription && product.nomeProdotto && product.nomeProdotto.length > 50) {
                            const cleanName = ShopifyExportService.cleanText(product.nomeProdotto);
                            if (cleanName.includes('Intel') || cleanName.includes('AMD') || cleanName.includes('GB')) {
                                baseDescription = `<p><strong>${marca} ${product.categoria?.nome || 'Notebook'}</strong></p><p>${cleanName}</p>`;
                            }
                        }


                        let fullDescription = '';

                        // CONTROLLO PERSISTENZA: Se la descrizione è già stata generata completamente (es. da AIEnrichmentService nella Fase 3)
                        // la usiamo direttamente senza rigenerarla. Questo rispetta il flusso "Arricchimento -> Export".
                        if (baseDescription && baseDescription.includes('class="product-description"')) {
                            // La descrizione è già formattata HTML completo
                            fullDescription = baseDescription;
                        } else {
                            // Generazione Standard
                            fullDescription = this.generateFullHtmlDescription(
                                baseDescription,
                                bulletPoints,
                                specsTable,
                                promotionalText,
                                marca,
                                product.nomeProdotto || '',
                                product.categoria?.nome || '',
                                specifiche,
                                tipoPC,
                                processore,
                                ram,
                                ssd,
                                gpu,
                                displayDesc,
                                os,
                                product.datiIcecat?.descrizioneBrave || ''
                            );
                        }

                        // Genera titolo ottimizzato (SENZA CHIAMATE ESTERNE)
                        const optimizedTitle = this.generateOptimizedTitle(
                            marca,
                            product.nomeProdotto || '',
                            specifiche,
                            product.categoria?.nome || '',
                            product.datiIcecat?.descrizioneBrave || '',
                            product.eanGtin
                        );

                        // Genera tags ottimizzati
                        const tags = this.generateTags(
                            product,
                            specifiche,
                            marca,
                            tipoPC,
                            processore,
                            ram,
                            ssd,
                            gpu
                        );

                        // Filtra immagini e rimuovi duplicati
                        const uniqueImages = [...new Set(immagini as string[])];
                        const validImages = uniqueImages.filter((img: string) => {
                            if (!img) return false;
                            const imgLower = img.toLowerCase();
                            if (marca.toLowerCase() === 'lenovo' && imgLower.includes('asus.com')) return false;
                            if (marca.toLowerCase() === 'hp' && imgLower.includes('asus.com')) return false;
                            if (marca.toLowerCase() === 'asus' && imgLower.includes('lenovo.com')) return false;
                            return true;
                        });

                        return {
                            ean: product.eanGtin,
                            nome: optimizedTitle,
                            marca: marca,
                            tags: tags,
                            prezzo: Math.ceil(product.prezzoVenditaCalcolato || 0),
                            quantita: product.quantitaTotaleAggregata || 0,
                            immagini: validImages,
                            famiglia: product.categoria?.nome || '',
                            tipologiaDisplay: this.detectDisplayType(specifiche),
                            touchScreen: this.detectTouchScreen(specifiche, product.nomeProdotto || ''),
                            rapportoAspetto: this.detectAspectRatio(specifiche),
                            'risoluzione Monitor': this.detectResolution(specifiche),
                            dimensioneMonitor: this.detectMonitorSize(specifiche),
                            dimensioneSchermo: this.detectScreenSize(specifiche),
                            display: this.generateDisplayDescription(specifiche),
                            tipoPC: tipoPC,
                            capacitaSSD: ssd,
                            schedaVideo: this.extractGPU(specifiche),
                            sistemaOperativo: this.extractOS(specifiche),
                            ram: ram,
                            processoreBrand: processore,
                            cpu: this.extractCPU(specifiche),
                            descrizioneBrave: product.datiIcecat?.descrizioneBrave || '',
                            descrizioneLunga: fullDescription,
                            testoPersonalizzato: promotionalText,
                            tabellaSpecifiche: specsTable,
                            schedaPDF: this.extractPDFUrl(documenti),
                            productCode: productCode
                        } as ShopifyProduct;

                    } catch (err: any) {
                        logger.error(`❌ Errore processamento prodotto ${product.eanGtin}: ${err.message}`);
                        return null;
                    }
                }));

                // Aggiungi risultati validi
                const validProducts = batchResults.filter((p): p is ShopifyProduct => p !== null);
                shopifyProducts.push(...validProducts);

                processedCount += products.length;
                if (processedCount % 500 === 0 || processedCount === totalProducts) {
                    logger.info(`📊 Processati ${processedCount}/${totalProducts} prodotti...`);
                }
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.info(`✅ Generazione completata in ${duration}s. Generati ${shopifyProducts.length} prodotti.`);

            return shopifyProducts;

        } catch (error: any) {
            logger.error('❌ Errore generazione export Shopify:', error.message);
            throw error;
        }
    }
}
