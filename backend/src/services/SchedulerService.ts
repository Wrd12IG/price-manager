// @ts-nocheck
import { logger } from '../utils/logger';
import cron from 'node-cron';
import prisma from '../config/database';
import { jobProgressManager } from './JobProgressService';
import { ShopifyService } from './ShopifyService';

/**
 * Servizio per la gestione degli scheduler/cron jobs
 */
export class SchedulerService {

    private static activeRuns: Set<number> = new Set();
    private static activeTasks: Map<string, cron.ScheduledTask> = new Map();

    /**
     * Inizializza gli scheduler per tutti gli utenti
     */
    static async init(): Promise<void> {
        logger.info('⏰ Inizializzazione Scheduler Multi-Tenant');

        // 1. Ferma task esistenti
        this.stopAllTasks();

        // 2. Recupera tutti gli utenti attivi
        const utenti = await prisma.utente.findMany({ where: { attivo: true } });

        for (const utente of utenti) {
            // 3. Carica configurazione specifica per l'utente
            const schedules = await this.loadUserSchedules(utente.id);

            // 4. Avvia i task per questo utente
            schedules.forEach(expression => {
                this.scheduleWorkflow(expression, utente.id);
            });

            logger.info(`✅ Scheduler configurato per ${utente.email}: ${schedules.length} regole.`);
        }
    }

    /**
     * Ferma tutti i task attivi
     */
    private static stopAllTasks() {
        this.activeTasks.forEach(task => task.stop());
        this.activeTasks.clear();
    }

    /**
     * Carica schedulazioni dal DB per un utente specifico
     */
    private static async loadUserSchedules(utenteId: number): Promise<string[]> {
        try {
            const config = await prisma.configurazioneSistema.findFirst({
                where: {
                    utenteId,
                    chiave: 'workflow_schedules'
                }
            });

            if (config?.valore) {
                try {
                    const parsed = JSON.parse(config.valore);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    logger.error(`Errore parsing workflow_schedules per utente ${utenteId}:`, e);
                }
            }

            // Default se non esiste o errore
            const defaultSchedule = ['0 3 * * *'];

            // Non creiamo automaticamente per non inquinare il DB se non necessario, 
            // ma restituiamo il default.
            return defaultSchedule;

        } catch (error) {
            logger.error(`Errore caricamento schedulazioni utente ${utenteId}:`, error);
            return ['0 3 * * *'];
        }
    }

    /**
     * Schedula un singolo workflow per un utente
     */
    private static scheduleWorkflow(expression: string, utenteId: number) {
        if (!cron.validate(expression)) {
            logger.warn(`⚠️ Espressione CRON non valida (utente ${utenteId}): ${expression}`);
            return;
        }

        const taskKey = `${utenteId}_${expression}`;
        const task = cron.schedule(expression, () => {
            logger.info(`🕒 Esecuzione programmata workflow utente ${utenteId} (${expression})`);
            this.runFullWorkflow(utenteId)
                .catch(err => logger.error(`❌ Errore workflow utente ${utenteId}:`, err));
        });

        this.activeTasks.set(taskKey, task);
    }

    /**
     * Restituisce le schedule attive per un utente
     */
    static async getSchedules(utenteId: number): Promise<string[]> {
        return this.loadUserSchedules(utenteId);
    }

    /**
     * Aggiunge una nuova schedule per un utente
     */
    static async addSchedule(utenteId: number, expression: string): Promise<boolean> {
        if (!cron.validate(expression)) throw new Error('Espressione CRON non valida');

        const current = await this.getSchedules(utenteId);
        if (current.includes(expression)) return false;

        const updated = [...current, expression];
        await this.saveUserSchedules(utenteId, updated);
        await this.init(); // Ricarica tutto
        return true;
    }

    /**
     * Rimuove una schedule per un utente
     */
    static async removeSchedule(utenteId: number, expression: string): Promise<boolean> {
        const current = await this.getSchedules(utenteId);
        const updated = current.filter(s => s !== expression);

        if (updated.length === current.length) return false;

        await this.saveUserSchedules(utenteId, updated);
        await this.init();
        return true;
    }

    /**
     * Salva configurazione nel DB per l'utente
     */
    private static async saveUserSchedules(utenteId: number, schedules: string[]) {
        await prisma.configurazioneSistema.upsert({
            where: {
                utenteId_chiave: {
                    utenteId: utenteId,
                    chiave: 'workflow_schedules'
                }
            },
            create: {
                utenteId: utenteId,
                chiave: 'workflow_schedules',
                valore: JSON.stringify(schedules),
                tipo: 'json'
            },
            update: {
                valore: JSON.stringify(schedules)
            }
        });
    }

    /**
     * Restituisce lo stato dello scheduler per l'utente
     */
    static getStatus(utenteId: number): { isRunning: boolean } {
        return {
            isRunning: this.activeRuns.has(utenteId)
        };
    }

    /**
     * Helper per creare log nel DB
     */
    private static async createLog(utenteId: number, fase: string, stato: string = 'running', dettagli: any = null) {
        try {
            return await prisma.logElaborazione.create({
                data: {
                    utenteId,
                    faseProcesso: fase,
                    stato: stato,
                    dettagliJson: dettagli ? JSON.stringify(dettagli) : null,
                    prodottiProcessati: 0,
                    dataEsecuzione: new Date()
                }
            });
        } catch (e: any) {
            logger.error(`Errore creazione log DB (${fase}) per utente ${utenteId}:`, e.message);
            return null;
        }
    }

    /**
     * Helper per aggiornare log nel DB
     */
    private static async updateLog(id: number, stato: string, prodotti: number, errori: number, dettagli: any = null, startTime: number) {
        try {
            const durata = Math.round((Date.now() - startTime) / 1000);
            await prisma.logElaborazione.update({
                where: { id },
                data: {
                    stato: stato,
                    prodottiProcessati: prodotti,
                    prodottiErrore: errori,
                    durataSecondi: durata,
                    dettagliJson: dettagli ? JSON.stringify(dettagli) : undefined
                }
            });
        } catch (e: any) {
            logger.error(`Errore aggiornamento log DB (ID ${id}):`, e.message);
        }
    }

    /**
     * Esegue il workflow completo per un utente specifico
     */
    static async runFullWorkflow(utenteId: number): Promise<void> {
        if (this.activeRuns.has(utenteId)) {
            logger.warn(`⚠️ Workflow già in esecuzione per utente ${utenteId}`);
            return;
        }

        this.activeRuns.add(utenteId);
        logger.info(`🚀 Avvio workflow completo per utente ${utenteId}...`);

        // Struttura per tracciare le fasi
        interface PhaseResult {
            numero: number;
            nome: string;
            icona: string;
            dettagli: string[];
            stato: 'success' | 'warning' | 'error';
        }
        const phases: PhaseResult[] = [];
        let errorInfo: { fase: number; nomeFase: string; descrizione: string; dettagliTecnici?: string } | null = null;

        const globalLog = await this.createLog(utenteId, 'WORKFLOW_COMPLETO', 'running', { triggeredBy: 'scheduler' });
        const startTime = Date.now();

        const jobId = jobProgressManager.createJob('merge', { utenteId, mainWorkflow: true });
        jobProgressManager.startJob(jobId, 'Avvio Workflow Completo...');

        try {
            // --- FASE 1: IMPORT LISTINI E AGGIORNAMENTO MASTER FILE ---
            logger.info(`--- FASE 1 (Utente ${utenteId}): Aggiornamento Listini ---`);
            const logFase1 = await this.createLog(utenteId, 'IMPORT_LISTINI');
            const startFase1 = Date.now();

            const { ImportService } = await import('./ImportService');
            const importResult = await ImportService.importAllListini(utenteId);

            const successCount = importResult.results.filter(r => r.success).length;
            const failCount = importResult.results.filter(r => !r.success).length;
            const totalImported = importResult.results.length;

            phases.push({
                numero: 1,
                nome: 'Aggiornamento Listini',
                icona: failCount > 0 ? '⚠️' : '✅',
                stato: failCount > 0 ? 'warning' : 'success',
                dettagli: [
                    `Fornitori processati: ${totalImported}`,
                    `Successi: ${successCount}`,
                    `Errori: ${failCount}`
                ]
            });

            jobProgressManager.updateProgress(jobId, 15, 'Listini aggiornati con successo');
            if (logFase1) await this.updateLog(logFase1.id, 'success', totalImported, failCount, importResult, startFase1);

            // --- FASE 1.5: CONSOLIDAMENTO MASTER FILE ---
            logger.info(`--- FASE 1.5 (Utente ${utenteId}): Consolidamento Master File ---`);
            const logFase1_5 = await this.createLog(utenteId, 'CONSOLIDAMENTO_MASTERFILE');
            const startFase1_5 = Date.now();

            const { MasterFileService } = await import('./MasterFileService');
            const consolidationResult = await MasterFileService.consolidaMasterFile(utenteId);

            phases.push({
                numero: 1.5,
                nome: 'Consolidamento Master File',
                icona: '🎯',
                stato: 'success',
                dettagli: [
                    `Prodotti consolidati: ${consolidationResult.consolidated}`,
                    `Prodotti filtrati: ${consolidationResult.filtered}`
                ]
            });

            jobProgressManager.updateProgress(jobId, 30, 'Catalogo consolidato e filtrato');
            if (logFase1_5) await this.updateLog(logFase1_5.id, 'success', consolidationResult.consolidated, 0, consolidationResult, startFase1_5);

            // --- FASE 1.7: RECUPERO IDENTITÀ ---
            logger.info(`--- FASE 1.7 (Utente ${utenteId}): Identificazione Prodotti ---`);
            const logFase1_7 = await this.createLog(utenteId, 'RECUPERO_IDENTITA');
            const startFase1_7 = Date.now();

            const { ProductIdentityService } = await import('./ProductIdentityService');
            const identityResult = await ProductIdentityService.recoverIdentities(utenteId);

            phases.push({
                numero: 1.7,
                nome: 'Identificazione Prodotti',
                icona: '🆔',
                stato: 'success',
                dettagli: [
                    `Recuperati Icecat/AI: ${identityResult.recoveredIcecat + identityResult.recoveredAI}`,
                    `Falliti: ${identityResult.failed}`
                ]
            });

            if (identityResult.recoveredIcecat > 0 || identityResult.recoveredAI > 0) {
                const { MarkupService } = await import('./MarkupService');
                await MarkupService.applicaRegolePrezzi(utenteId);
            }

            jobProgressManager.updateProgress(jobId, 45, 'Identità prodotti recuperate');
            if (logFase1_7) await this.updateLog(logFase1_7.id, 'success', identityResult.recoveredIcecat + identityResult.recoveredAI, identityResult.failed, identityResult, startFase1_7);


            // --- FASE 2: ARRICCHIMENTO DATI (ICECAT) ---
            logger.info(`--- FASE 2 (Utente ${utenteId}): Arricchimento Icecat ---`);
            const logFase2_Icecat = await this.createLog(utenteId, 'ARRICCHIMENTO_ICECAT');
            const startFase2_Icecat = Date.now();

            const { IcecatService } = await import('./IcecatService');
            const icecatConfig = await IcecatService.getConfig(utenteId);
            let icecatResult = { enriched: 0, skipped: 0, errors: 0, total: 0 };

            if (icecatConfig.configured) {
                icecatResult = await IcecatService.enrichMasterFile(utenteId);
            }

            phases.push({
                numero: 2,
                nome: 'Arricchimento Icecat',
                icona: icecatConfig.configured ? '✅' : '⏭️',
                stato: 'success',
                dettagli: [`Prodotti arricchiti: ${icecatResult.enriched}`]
            });

            jobProgressManager.updateProgress(jobId, 60, 'Dati Icecat arricchiti');
            if (logFase2_Icecat) await this.updateLog(logFase2_Icecat.id, 'success', icecatResult.enriched, icecatResult.errors, icecatResult, startFase2_Icecat);

            // --- FASE 2.5: OTTIMIZZAZIONE AI ---
            logger.info(`--- FASE 2.5 (Utente ${utenteId}): Ottimizzazione AI ---`);
            const logFase2_AI = await this.createLog(utenteId, 'OTTMIZZAZIONE_AI');
            const startFase2_AI = Date.now();

            const { AIEnrichmentService } = await import('./AIEnrichmentService');
            let totalEnriched = 0;
            for (let i = 0; i < 20; i++) {
                const batchResult = await AIEnrichmentService.processBatch(utenteId, 50);
                totalEnriched += batchResult.success;
                if (batchResult.processed === 0) break;
                await new Promise(r => setTimeout(r, 500));
            }

            phases.push({
                numero: 2.5,
                nome: 'Arricchimento AI Gemini',
                icona: '✅',
                stato: 'success',
                dettagli: [`Contenuti generati: ${totalEnriched}`]
            });

            jobProgressManager.updateProgress(jobId, 75, 'Ottimizzazione AI Gemini completata');
            if (logFase2_AI) await this.updateLog(logFase2_AI.id, 'success', totalEnriched, 0, { enriched: totalEnriched }, startFase2_AI);


            // --- FASE 3: GENERAZIONE EXPORT SHOPIFY ---
            logger.info(`--- FASE 3 (Utente ${utenteId}): Export Shopify ---`);
            const logFase3 = await this.createLog(utenteId, 'EXPORT_SHOPIFY');
            const startFase3 = Date.now();

            const { ShopifyExportService } = await import('./ShopifyExportService');
            await ShopifyExportService.generateExport(utenteId);
            const exportData = await ShopifyService.getSyncProgress(utenteId);
            const exportCount = exportData.total;

            phases.push({
                numero: 3,
                nome: 'Generazione Export Shopify',
                icona: '✅',
                stato: 'success',
                dettagli: [`Prodotti in export: ${exportCount}`]
            });

            jobProgressManager.updateProgress(jobId, 85, 'Export Shopify generato');
            if (logFase3) await this.updateLog(logFase3.id, 'success', exportCount, 0, { readyForExport: exportCount }, startFase3);


            // --- FASE 4: SINCRONIZZAZIONE SHOPIFY ---
            logger.info(`--- FASE 4 (Utente ${utenteId}): Sync Shopify ---`);
            const logFase4 = await this.createLog(utenteId, 'SYNC_SHOPIFY');
            const startFase4 = Date.now();

            const syncResult = await ShopifyService.syncProducts(utenteId);

            phases.push({
                numero: 4,
                nome: 'Sincronizzazione Shopify',
                icona: syncResult.errors > 0 ? '⚠️' : '✅',
                stato: syncResult.errors > 0 ? 'warning' : 'success',
                dettagli: [
                    `Totale: ${syncResult.total}`,
                    `OK: ${syncResult.synced}`,
                    `Errori: ${syncResult.errors}`
                ]
            });

            jobProgressManager.updateProgress(jobId, 95, 'Sincronizzazione Shopify completata');
            if (logFase4) await this.updateLog(logFase4.id, syncResult.errors > 0 ? 'warning' : 'success', syncResult.synced, syncResult.errors, syncResult, startFase4);


            // --- INVIO REPORT SUCCESSO ---
            const durationMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            await this.sendSuccessEmail(utenteId, phases, durationMinutes);

            logger.info(`✅ Workflow completo terminato per utente ${utenteId}.`);
            jobProgressManager.completeJob(jobId, 'Workflow Completato con Successo');
            if (globalLog) await this.updateLog(globalLog.id, 'success', 0, 0, { totalDuration: durationMinutes + 'm' }, startTime);

        } catch (error: any) {
            logger.error(`❌ Errore critico workflow utente ${utenteId}:`, error);

            const lastPhase = phases.length > 0 ? phases[phases.length - 1].numero : 0;
            errorInfo = {
                fase: lastPhase + 1,
                nomeFase: this.getPhaseNameByNumber(lastPhase + 1),
                descrizione: error.message,
                dettagliTecnici: error.stack?.substring(0, 500)
            };

            await this.sendErrorEmail(utenteId, phases, errorInfo);
            jobProgressManager.failJob(jobId, error.message);
            if (globalLog) await this.updateLog(globalLog.id, 'error', 0, 1, { error: error.message }, startTime);
        } finally {
            this.activeRuns.delete(utenteId);
        }
    }

    private static getPhaseNameByNumber(num: number): string {
        const names: { [key: number]: string } = {
            1: 'Aggiornamento Listini e Master File',
            2: 'Arricchimento Dati',
            3: 'Generazione Export Shopify',
            4: 'Sincronizzazione Shopify'
        };
        return names[num] || 'Fase Sconosciuta';
    }

    private static formatDateTime(date: Date = new Date()): string {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${d}/${m}/${y}, ${h}:${min}:${s}`;
    }

    /**
     * Invia email di report SUCCESSO
     */
    private static async sendSuccessEmail(utenteId: number, phases: any[], durationMinutes: string) {
        try {
            const { EmailService } = await import('./EmailService');
            let recipientEmail = null;
            const emailConfig = await prisma.configurazioneSistema.findFirst({
                where: { utenteId, chiave: 'notification_email' }
            });

            if (emailConfig?.valore) {
                recipientEmail = emailConfig.valore;
            } else {
                // Fallback all'email dell'account
                const utente = await prisma.utente.findUnique({ where: { id: utenteId } });
                recipientEmail = utente?.email;
            }

            if (!recipientEmail) { logger.warn('⚠️ Nessuna email di notifica trovata (config o account).'); return; }

            const phasesHtml = phases.map(p => `
                <div style="margin-bottom: 20px; padding: 15px; background-color: ${p.stato === 'warning' ? '#fff8e1' : '#e8f5e9'}; border-left: 4px solid ${p.stato === 'warning' ? '#ffc107' : '#4caf50'}; border-radius: 4px;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">${p.icona} FASE ${p.numero}: ${p.nome}</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #555;">
                        ${p.dettagli.map((d: string) => `<li>${d}</li>`).join('')}
                    </ul>
                </div>
            `).join('');

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2e7d32; border-bottom: 2px solid #4caf50; padding-bottom: 10px;">
                        ✅ Report Workflow Automatico
                    </h2>
                    <p style="color: #666;">Esecuzione terminata il <strong>${this.formatDateTime()}</strong></p>
                    
                    ${phasesHtml}

                    <div style="margin-top: 25px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
                        <p style="margin: 0;"><strong>⏱️ Tempo totale esecuzione:</strong> ${durationMinutes} minuti</p>
                    </div>

                    <p style="margin-top: 30px; color: #888;">
                        Saluti,<br>
                        <strong>Il tuo Price Manager</strong>
                    </p>
                </div>
            `;

            await EmailService.send(recipientEmail, "✅ Report Workflow Price Manager", html, true);
            logger.info(`📧 Report successo inviato a ${recipientEmail}`);
        } catch (e: any) {
            logger.error('Errore invio email successo:', e);
        }
    }

    /**
     * Invia email di report ERRORE
     */
    private static async sendErrorEmail(utenteId: number, phases: any[], errorInfo: any) {
        try {
            const { EmailService } = await import('./EmailService');
            let recipientEmail = null;
            const emailConfig = await prisma.configurazioneSistema.findFirst({
                where: { utenteId, chiave: 'notification_email' }
            });

            if (emailConfig?.valore) {
                recipientEmail = emailConfig.valore;
            } else {
                // Fallback all'email dell'account
                const utente = await prisma.utente.findUnique({ where: { id: utenteId } });
                recipientEmail = utente?.email;
            }

            if (!recipientEmail) { logger.warn('⚠️ Nessuna email di notifica trovata (config o account).'); return; }

            // Fasi completate prima dell'errore
            const completedPhasesHtml = phases.map(p => `
                <div style="margin-bottom: 15px; padding: 10px; background-color: #e8f5e9; border-left: 3px solid #4caf50; border-radius: 4px;">
                    <strong>${p.icona} FASE ${p.numero}: ${p.nome}</strong> - Completata
                </div>
            `).join('');

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #c62828; border-bottom: 2px solid #ef5350; padding-bottom: 10px;">
                        ⚠️ Report Workflow Automatico - ERRORE CRITICO
                    </h2>
                    <p style="color: #666;">Esecuzione terminata il <strong>${this.formatDateTime()}</strong></p>

                    ${phases.length > 0 ? `
                        <h3 style="color: #388e3c;">Fasi Completate:</h3>
                        ${completedPhasesHtml}
                    ` : ''}

                    <div style="margin: 25px 0; padding: 20px; background-color: #ffebee; border-left: 4px solid #c62828; border-radius: 4px;">
                        <h3 style="margin: 0 0 10px 0; color: #c62828;">❌ FASE ${errorInfo.fase}: ${errorInfo.nomeFase} - INTERROTTA</h3>
                        
                        <p style="margin: 15px 0 5px 0;"><strong>ERRORE:</strong></p>
                        <p style="margin: 0; color: #b71c1c; font-family: monospace; background: #fff; padding: 10px; border-radius: 4px;">
                            ${errorInfo.descrizione}
                        </p>

                        <p style="margin: 20px 0 5px 0;"><strong>IMPATTO:</strong></p>
                        <ul style="margin: 0; color: #555;">
                            <li>Il workflow è stato interrotto alla fase ${errorInfo.fase}</li>
                            <li>Le fasi successive non sono state eseguite</li>
                            <li>Potrebbe essere necessario un intervento manuale</li>
                        </ul>

                        <p style="margin: 20px 0 5px 0;"><strong>AZIONE RICHIESTA:</strong></p>
                        <p style="margin: 0; color: #555;">Verificare i log nel sistema e riavviare il workflow manualmente dopo aver risolto il problema.</p>

                        ${errorInfo.dettagliTecnici ? `
                            <p style="margin: 20px 0 5px 0;"><strong>DETTAGLI TECNICI:</strong></p>
                            <pre style="margin: 0; font-size: 11px; background: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${errorInfo.dettagliTecnici}</pre>
                        ` : ''}
                    </div>

                    <p style="margin-top: 30px; color: #888;">
                        Saluti,<br>
                        <strong>Il tuo Price Manager</strong>
                    </p>
                </div>
            `;

            await EmailService.send(recipientEmail, "⚠️ ERRORE Workflow Price Manager", html, true);
            logger.info(`📧 Report errore inviato a ${recipientEmail}`);
        } catch (e: any) {
            logger.error('Errore invio email errore:', e);
        }
    }
}

