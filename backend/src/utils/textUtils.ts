/**
 * Utility per la pulizia e normalizzazione dei testi dei fornitori.
 */
export class TextUtils {
    /**
     * Pulisce e formatta il testo (titoli o descrizioni)
     * - Rimuove tag HTML in modo intelligente (evitando che le parole si attacchino)
     * - Corregge la spaziatura dopo la punteggiatura
     * - Decodifica entità HTML
     * - Rimuove simboli di disturbo
     */
    public static cleanText(text: string | null): string | null {
        if (!text || text === undefined) return null;
        let t = text.toString();

        // 1. Gestione HTML: sostituiamo i tag di blocco/interruzione con spazi per evitare "testoappiccicato"
        if (t.includes('<') || t.includes('>')) {
            // Sostituiamo tag di blocco comuni con spazi
            t = t.replace(/<(p|br|div|li|h[1-6]|tr|td|blockquote|section|article|dt|dd|table|thead|tbody|tfoot)[^>]*>/gi, ' ');
            t = t.replace(/<\/(p|div|li|h[1-6]|tr|td|blockquote|section|article|dt|dd|table|thead|tbody|tfoot)>/gi, ' ');
            // Rimuoviamo tutti gli altri tag HTML residui
            t = t.replace(/<[^>]*>/g, ' ');
        }

        // 2. Decodifica entità HTML comuni
        t = t.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, '"')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&apos;/gi, "'")
             .replace(/&agrave;/gi, 'à')
             .replace(/&egrave;/gi, 'è')
             .replace(/&igrave;/gi, 'ì')
             .replace(/&ograve;/gi, 'ò')
             .replace(/&ugrave;/gi, 'ù')
             .replace(/&eacute;/gi, 'é')
             .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec)))
             .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

        // 3. Rimuove simboli di disturbo specifici e caratteri di controllo
        t = t.replace(/[§\t\r\n]/g, ' ');
        t = t.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' '); // Rimuove caratteri non stampabili

        // 4. FIX SPAZIATURA PUNTUALE (es. "Fine.Inizio" -> "Fine. Inizio")
        // Applica lo spazio dopo . , ; : ! ? " se seguito da una lettera o numero senza spazio
        // NOTA: evitiamo di spezzare decimali (es. 1.23) usando un lookahead negativo o controllo specifico
        t = t.replace(/([,;!?:"])([A-Za-z0-9])/g, '$1 $2');
        
        // Per il punto, facciamo attenzione ai decimali o domini:
        // Aggiunge spazio dopo il punto solo se seguito da una lettera MAIUSCOLA (nuova frase)
        // o se non è circondato da numeri.
        t = t.replace(/(\.)([A-Z])/g, '$1 $2');
        t = t.replace(/([a-zA-Z])(\.)([a-zA-Z])/g, '$1$2 $3');

        // 5. Corregge eventuali spazi PRIMA della punteggiatura (es. "Fine ." -> "Fine.")
        t = t.replace(/\s+([.,;!?:])/g, '$1');

        // 6. Normalizzazione spazi (rimuove spazi multipli)
        t = t.replace(/\s+/g, ' ');
        
        return t.trim();
    }
}
