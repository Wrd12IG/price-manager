#!/bin/bash
# ============================================
# PRICE MANAGER - WORKFLOW AUTOMATICO GIORNALIERO (HYBRID MODE)
# ============================================
# Questo script:
# 1. Scarica i listini localmente (nessun blocco IP)
# 2. Sincronizza i dati con Supabase
# 3. Mantiene frontend e API sempre aggiornati

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/tmp/price-manager-workflow.log"
BACKEND_DIR="$SCRIPT_DIR/backend"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Funzione per importare i listini localmente
import_listini_local() {
    log "📥 Importazione listini (locale → Supabase)..."
    
    cd "$BACKEND_DIR"
    
    # Esegue lo script di importazione
    npx tsx src/scripts/importAll.ts 2>&1 | while read line; do
        log "   $line"
    done
    
    if [ $? -eq 0 ]; then
        log "✅ Importazione completata"
        return 0
    else
        log "❌ Errore importazione"
        return 1
    fi
}

# Funzione per consolidare il master file
consolidate_master() {
    log "🔄 Consolidamento Master File..."
    
    cd "$BACKEND_DIR"
    
    npx tsx -e "
    import prisma from './src/config/database';
    import { MasterFileService } from './src/services/MasterFileService';
    
    async function main() {
        console.log('Avvio consolidamento...');
        const user = await prisma.utente.findFirst();
        if (!user) throw new Error('User not found');
        await MasterFileService.consolidaMasterFile(user.id);
        console.log('Consolidamento completato');
        await prisma.\$disconnect();
    }
    main().catch(console.error);
    " 2>&1 | while read line; do
        log "   $line"
    done
    
    return 0
}

# Funzione per generare export Shopify
generate_shopify() {
    log "🛒 Generazione export Shopify..."
    
    cd "$BACKEND_DIR"
    
    npx tsx -e "
    import prisma from './src/config/database';
    import { ShopifyExportService } from './src/services/ShopifyExportService';
    
    async function main() {
        console.log('Preparazione export Shopify...');
        const user = await prisma.utente.findFirst();
        if (!user) throw new Error('User not found');
        const result = await ShopifyExportService.generateExport(user.id);
        console.log('Export preparato:', result.length, 'prodotti');
        await prisma.\$disconnect();
    }
    main().catch(console.error);
    " 2>&1 | while read line; do
        log "   $line"
    done
    
    return 0
}

# Funzione per verificare stato
check_status() {
    log "📊 Verifica stato finale..."
    
    cd "$BACKEND_DIR"
    
    npx tsx -e "
    import prisma from './src/config/database';
    
    async function main() {
        const fornitori = await prisma.fornitore.count();
        const marchi = await prisma.marchio.count();
        const categorie = await prisma.categoria.count();
        const prodotti = await prisma.masterFile.count();
        const shopify = await prisma.outputShopify.count();
        
        console.log('=== STATISTICHE ===');
        console.log('Fornitori:', fornitori);
        console.log('Marchi:', marchi);
        console.log('Categorie:', categorie);
        console.log('Prodotti Master File:', prodotti);
        console.log('Prodotti Shopify:', shopify);
        
        await prisma.\$disconnect();
    }
    main().catch(console.error);
    " 2>&1 | while read line; do
        log "   $line"
    done
}

# Funzione principale
main() {
    log ""
    log "═══════════════════════════════════════════════════════════"
    log "   PRICE MANAGER - WORKFLOW HYBRID"
    log "   Esecuzione: $(date '+%Y-%m-%d %H:%M:%S')"
    log "═══════════════════════════════════════════════════════════"
    
    # Verifica che siamo nella directory corretta
    if [ ! -d "$BACKEND_DIR" ]; then
        log "❌ Directory backend non trovata: $BACKEND_DIR"
        exit 1
    fi
    
    # Step 1: Importa listini
    import_listini_local
    
    # Step 2: Consolida Master File
    consolidate_master
    
    # Step 3: Genera export Shopify
    generate_shopify
    
    # Step 4: Verifica finale
    check_status
    
    log ""
    log "═══════════════════════════════════════════════════════════"
    log "   ✅ WORKFLOW COMPLETATO!"
    log "═══════════════════════════════════════════════════════════"
    log ""
}

# Esegui
main "$@"
