
/**
 * Utility per l'elaborazione dei dati Icecat
 */
export class IcecatUtils {
    /**
     * Estrae il brand dalle specifiche tecniche in modo sicuro,
     * evitando campi come "Brand compatibility"
     */
    static extractBrandFromFeatures(features: any[]): string | null {
        if (!Array.isArray(features)) return null;

        // 1. Cerca match esatti o molto specifici
        const priorityMatch = features.find(f => {
            const name = f.name?.toLowerCase().trim() || '';
            return name === 'brand' ||
                name === 'marca' ||
                name === 'produttore' ||
                name === 'manufacturer' ||
                name === 'brand name';
        });

        if (priorityMatch?.value) return priorityMatch.value;

        // 2. Cerca match parziali ma escludi esplicitamente campi di compatibilità
        const safeMatch = features.find(f => {
            const name = f.name?.toLowerCase().trim() || '';

            // Escludi campi che indicano compatibilità
            if (name.includes('compatib') || // compatibilità, compatibile, compatibility, compatible
                name.includes('support') ||  // supported
                name.includes('for')) {      // designed for
                return false;
            }

            return name.includes('brand') ||
                name.includes('marca') ||
                name.includes('produttore') ||
                name.includes('manufacturer');
        });

        return safeMatch?.value || null;
    }
}
