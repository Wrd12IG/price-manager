/**
 * Flag globale per cancellare la sync Shopify in corso (per utente).
 * Separato in un file indipendente per evitare circular imports
 * tra shopify.controller.ts e ShopifyService.ts.
 */

const cancelFlags = new Map<number, boolean>();

export function isSyncCancelled(utenteId: number): boolean {
    return cancelFlags.get(utenteId) === true;
}

export function clearCancelFlag(utenteId: number): void {
    cancelFlags.delete(utenteId);
}

export function setCancelFlag(utenteId: number): void {
    cancelFlags.set(utenteId, true);
}
