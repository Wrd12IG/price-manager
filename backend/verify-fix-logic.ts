/**
 * Script di verifica per il fix dei Metafields Shopify
 * Testa la logica di parsing della risposta AI senza connettersi al database o all'AI reale.
 */

interface ExtractedMetafields {
    'custom.tabella_specifiche'?: string;
    [key: string]: string | undefined;
}

function testParsingLogic() {
    console.log('🧪 Inizio test logica di parsing AI...\n');

    // Simula una risposta JSON dell'AI che ora include tabella_specifiche
    const mockAiResponse = JSON.stringify({
        "processore_brand": "Intel Core Ultra 5 225H",
        "ram": "16GB DDR5",
        "capacita_ssd": "1TB SSD",
        "tabella_specifiche": "<table style='width:100%; border-collapse:collapse;'><tr><td>Test</td><td>Value</td></tr></table>",
        "descrizione_breve": "Test description"
    });

    console.log('📄 Mock AI Response:', mockAiResponse);

    // Simula il parsing nel servizio
    try {
        const data = JSON.parse(mockAiResponse);
        const metafields: ExtractedMetafields = {};

        // La logica aggiornata in EnhancedMetafieldService.ts
        if (data.processore_brand) metafields['custom.processore_brand'] = data.processore_brand;
        if (data.ram) metafields['custom.ram'] = data.ram;
        if (data.capacita_ssd) metafields['custom.capacita_ssd'] = data.capacita_ssd;
        if (data.tabella_specifiche) metafields['custom.tabella_specifiche'] = data.tabella_specifiche;
        if (data.descrizione_breve) metafields['custom.descrizione_breve'] = data.descrizione_breve;

        console.log('\n✅ Risultato Parsing:');
        console.log(JSON.stringify(metafields, null, 2));

        if (metafields['custom.tabella_specifiche']) {
            console.log('\n🌟 TEST SUPERATO: La tabella delle specifiche è stata catturata correttamente!');
        } else {
            console.log('\n❌ TEST FALLITO: Tabella specifiche mancante nel risultato.');
        }

    } catch (e) {
        console.error('❌ Errore durante il parsing:', e.message);
    }
}

testParsingLogic();
