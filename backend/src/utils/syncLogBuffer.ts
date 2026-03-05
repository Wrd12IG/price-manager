/**
 * Buffer in memoria per i log della sync Shopify, per utente.
 * Usato dal frontend per mostrare un feed live durante la sincronizzazione.
 *
 * Design:
 *  - Ring buffer: mantiene al massimo MAX_ENTRIES per utente
 *  - Ogni entry ha timestamp, livello e messaggio
 *  - Il frontend chiede le entry con timestamp > lastSeen
 *  - Il buffer viene svuotato cuando l'utente avvia una nuova sync
 */

export type SyncLogLevel = 'info' | 'success' | 'warning' | 'error' | 'batch';

export interface SyncLogEntry {
    ts: number;       // Unix ms
    level: SyncLogLevel;
    msg: string;
}

const MAX_ENTRIES = 200;
const buffers = new Map<number, SyncLogEntry[]>();

/**
 * Aggiunge una entry al buffer dell'utente.
 * Automaticamente rimuove le entry più vecchie se si supera MAX_ENTRIES.
 */
export function syncLog(utenteId: number, level: SyncLogLevel, msg: string): void {
    if (!buffers.has(utenteId)) {
        buffers.set(utenteId, []);
    }
    const buf = buffers.get(utenteId)!;
    buf.push({ ts: Date.now(), level, msg });
    // Ring: tieni solo le ultime MAX_ENTRIES
    if (buf.length > MAX_ENTRIES) {
        buf.splice(0, buf.length - MAX_ENTRIES);
    }
}

/**
 * Restituisce le entry con ts > since (per il polling del frontend).
 * Se since = 0, restituisce tutte le entry.
 */
export function getLogsAfter(utenteId: number, since: number): SyncLogEntry[] {
    const buf = buffers.get(utenteId) || [];
    return since === 0 ? [...buf] : buf.filter(e => e.ts > since);
}

/**
 * Svuota il buffer dell'utente. Da chiamare all'inizio di una nuova sync.
 */
export function clearSyncLog(utenteId: number): void {
    buffers.set(utenteId, []);
}
