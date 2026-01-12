import { logger } from '../utils/logger';
import cron from 'node-cron';
import prisma from '../config/database';

/**
 * Servizio per la gestione degli scheduler/cron jobs
 */
export class SchedulerService {

    private static isRunning = false;
    private static lastRun: Date | null = null;
    private static activeTasks: Map<string, cron.ScheduledTask> = new Map();

    /**
     * Inizializza gli scheduler
     */
    static async init(): Promise<void> {
        logger.info('⏰ Inizializzazione Scheduler Dinamico');

        // 1. Ferma task esistenti
        this.stopAllTasks();

        // 2. Carica configurazione dal DB
        const schedules = await this.loadSchedulesFromDB();

        // 3. Avvia i task
        schedules.forEach(expression => {
            this.scheduleWorkflow(expression);
        });

        logger.info(`✅ Scheduler avviato: ${schedules.length} regole attive.`);
    }

    /**
     * Ferma tutti i task attivi
     */
    private static stopAllTasks() {
        this.activeTasks.forEach(task => task.stop());
        this.activeTasks.clear();
    }

    /**
     * Carica schedulazioni dal DB o crea default
     */
    private static async loadSchedulesFromDB(): Promise<string[]> {
        try {
            const config = await prisma.configurazioneSistema.findUnique({
                where: { chiave: 'workflow_schedules' }
            });

            if (config?.valore) {
                try {
                    const parsed = JSON.parse(config.valore);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    logger.error('Errore parsing workflow_schedules:', e);
                }
            }

            // Default se non esiste o errore
            const defaultSchedule = ['0 3 * * *'];
            await prisma.configurazioneSistema.upsert({
                where: { chiave: 'workflow_schedules' },
                create: {
                    chiave: 'workflow_schedules',
                    valore: JSON.stringify(defaultSchedule),
                    tipo: 'json',
                    descrizione: 'Array di espressioni CRON per il workflow automatico'
                },
                update: {} // Non sovrascrivere se esiste ma è corrotto/vuoto, ok così
            });

            return defaultSchedule;

        } catch (error) {
            logger.error('Errore caricamento schedulazioni:', error);
            return ['0 3 * * *']; // Fallback in memory
        }
    }

    /**
     * Schedula un singolo workflow
     */
    private static scheduleWorkflow(expression: string) {
        if (!cron.validate(expression)) {
            logger.warn(`⚠️ Espressione CRON non valida ignorata: ${expression}`);
            return;
        }

        const task = cron.schedule(expression, () => {
            logger.info(`🕒 Esecuzione programmata workflow (${expression})`);
            this.runFullWorkflow()
                .catch(err => logger.error('❌ Errore esecuzione cron job:', err));
        });

        this.activeTasks.set(expression, task);
        logger.info(`📅 Programmato workflow: ${expression}`);
    }

    /**
     * Restituisce le schedule attive
     */
    static async getSchedules(): Promise<string[]> {
        return this.loadSchedulesFromDB();
    }

    /**
     * Aggiunge una nuova schedule
     */
    static async addSchedule(expression: string): Promise<boolean> {
        if (!cron.validate(expression)) throw new Error('Espressione CRON non valida');

        const current = await this.getSchedules();
        if (current.includes(expression)) return false; // Già esiste

        const updated = [...current, expression];
        await this.saveSchedules(updated);
        await this.init(); // Ricarica
        return true;
    }

    /**
     * Rimuove una schedule
     */
    static async removeSchedule(expression: string): Promise<boolean> {
        const current = await this.getSchedules();
        const updated = current.filter(s => s !== expression);

        if (updated.length === current.length) return false; // Non trovato

        await this.saveSchedules(updated);
        await this.init(); // Ricarica
        return true;
    }

    /**
     * Salva configurazione nel DB
     */
    private static async saveSchedules(schedules: string[]) {
        await prisma.configurazioneSistema.upsert({
            where: { chiave: 'workflow_schedules' },
            create: {
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
     * Restituisce lo stato dello scheduler
     */
    static getStatus(): { isRunning: boolean; lastRun: Date | null } {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun
        };
    }

    /**
     * Helper per creare log nel DB
     */
    private static async createLog(fase: string, stato: string = 'running', dettagli: any = null) {
        try {
            return await prisma.logElaborazione.create({
                data: {
                    faseProcesso: fase,
                    stato: stato,
                    dettagliJson: dettagli ? JSON.stringify(dettagli) : null,
                    prodottiProcessati: 0,
                    dataEsecuzione: new Date()
                }
            });
        } catch (e: any) {
            logger.error(`Errore creazione log DB (${fase}):`, e.message);
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
     * Esegue il workflow completo (import, consolidamento, arricchimento, export, sync, email)
     */
    static async runFullWorkflow(): Promise<void> {
        if (this.isRunning) {
            logger.warn('⚠️ Workflow già in esecuzione');
            return;
        }

        this.isRunning = true;
        this.lastRun = new Date();
        logger.info('🚀 Avvio workflow completo...');

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

        const globalLog = await this.createLog('WORKFLOW_COMPLETO', 'running', { triggeredBy: 'scheduler' });
        const startTime = Date.now();

        try {
            // --- FASE 1: IMPORT LISTINI E AGGIORNAMENTO MASTER FILE ---
            logger.info('--- FASE 1: Aggiornamento Listini e Master File ---');
            const logFase1 = await this.createLog('IMPORT_LISTINI');
            const startFase1 = Date.now();

            const { ImportService } = await import('./ImportService');
            const importResult = await ImportService.importAllListini();

            const successCount = importResult.results.filter(r => r.success).length;
            const failCount = importResult.results.filter(r => !r.success).length;
            const totalImported = importResult.results.length;

            phases.push({
                numero: 1,
                nome: 'Aggiornamento Listini e Master File',
                icona: failCount > 0 ? '⚠️' : '✅',
                stato: failCount > 0 ? 'warning' : 'success',
                dettagli: [
                    `Fornitori processati: ${totalImported}`,
                    `Successi: ${successCount}`,
                    `Errori: ${failCount}`
                ]
            });

            if (logFase1) await this.updateLog(logFase1.id, 'success', totalImported, failCount, importResult, startFase1);


            // --- FASE 2: ARRICCHIMENTO DATI ---
            logger.info('--- FASE 2: Arricchimento Dati (Icecat/AI) ---');
            const logFase2 = await this.createLog('ARRICCHIMENTO_DATI');
            const startFase2 = Date.now();

            const { AIEnrichmentService } = await import('./AIEnrichmentService');
            let totalEnriched = 0;
            const MAX_ENRICH_CYCLES = 20;
            const BATCH_SIZE = 50;

            for (let i = 0; i < MAX_ENRICH_CYCLES; i++) {
                const batchResult = await AIEnrichmentService.processBatch(BATCH_SIZE);
                totalEnriched += batchResult.success;
                if (batchResult.processed === 0) break;
                await new Promise(r => setTimeout(r, 500));
            }

            phases.push({
                numero: 2,
                nome: 'Arricchimento Dati',
                icona: '✅',
                stato: 'success',
                dettagli: [`Prodotti arricchiti (nuovi/aggiornati): ${totalEnriched}`]
            });

            if (logFase2) await this.updateLog(logFase2.id, 'success', totalEnriched, 0, { enriched: totalEnriched }, startFase2);


            // --- FASE 3: GENERAZIONE EXPORT SHOPIFY ---
            logger.info('--- FASE 3: Generazione Export Shopify ---');
            const logFase3 = await this.createLog('EXPORT_SHOPIFY');
            const startFase3 = Date.now();

            const { ShopifyService } = await import('./ShopifyService');
            const exportCount = await ShopifyService.prepareExport();

            phases.push({
                numero: 3,
                nome: 'Generazione Export Shopify',
                icona: '✅',
                stato: 'success',
                dettagli: [`Prodotti pronti per export: ${exportCount}`]
            });

            if (logFase3) await this.updateLog(logFase3.id, 'success', exportCount, 0, { readyForExport: exportCount }, startFase3);


            // --- FASE 4: SINCRONIZZAZIONE SHOPIFY ---
            logger.info('--- FASE 4: Sincronizzazione Shopify ---');
            const logFase4 = await this.createLog('SYNC_SHOPIFY');
            const startFase4 = Date.now();

            const syncResult = await ShopifyService.syncToShopify();

            phases.push({
                numero: 4,
                nome: 'Sincronizzazione Shopify',
                icona: syncResult.errors > 0 ? '⚠️' : '✅',
                stato: syncResult.errors > 0 ? 'warning' : 'success',
                dettagli: [
                    `Totale prodotti sync: ${syncResult.total}`,
                    `Caricati/Aggiornati: ${syncResult.synced}`,
                    `Errori: ${syncResult.errors}`
                ]
            });

            if (logFase4) await this.updateLog(logFase4.id, syncResult.errors > 0 ? 'warning' : 'success', syncResult.synced, syncResult.errors, syncResult, startFase4);


            // --- INVIO REPORT SUCCESSO ---
            const durationMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            await this.sendSuccessEmail(phases, durationMinutes);

            logger.info('✅ Workflow completo terminato con successo.');
            if (globalLog) await this.updateLog(globalLog.id, 'success', 0, 0, { totalDuration: durationMinutes + 'm' }, startTime);

        } catch (error: any) {
            logger.error('❌ Errore critico durante workflow:', error);

            // Determina in quale fase si è verificato l'errore
            const lastPhase = phases.length > 0 ? phases[phases.length - 1].numero : 0;
            errorInfo = {
                fase: lastPhase + 1,
                nomeFase: this.getPhaseNameByNumber(lastPhase + 1),
                descrizione: error.message,
                dettagliTecnici: error.stack?.substring(0, 500)
            };

            await this.sendErrorEmail(phases, errorInfo);
            if (globalLog) await this.updateLog(globalLog.id, 'error', 0, 1, { error: error.message }, startTime);
        } finally {
            this.isRunning = false;
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
    private static async sendSuccessEmail(phases: any[], durationMinutes: string) {
        try {
            const { EmailService } = await import('./EmailService');
            const emailConfig = await prisma.configurazioneSistema.findUnique({ where: { chiave: 'notification_email' } });
            const recipientEmail = emailConfig?.valore;
            if (!recipientEmail) { logger.warn('⚠️ Nessuna email di notifica configurata.'); return; }

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
    private static async sendErrorEmail(phases: any[], errorInfo: any) {
        try {
            const { EmailService } = await import('./EmailService');
            const emailConfig = await prisma.configurazioneSistema.findUnique({ where: { chiave: 'notification_email' } });
            const recipientEmail = emailConfig?.valore;
            if (!recipientEmail) { logger.warn('⚠️ Nessuna email di notifica configurata.'); return; }

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

