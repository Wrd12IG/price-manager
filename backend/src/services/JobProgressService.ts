/**
 * JobProgressService - Gestisce lo stato dei job in background
 * con progress tracking in tempo reale
 */

interface JobProgress {
    id: string;
    type: 'import' | 'export' | 'enrichment' | 'merge';
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number; // 0-100
    message: string;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    metadata?: Record<string, any>;
}

class JobProgressManager {
    private jobs: Map<string, JobProgress> = new Map();
    private listeners: Map<string, Set<(job: JobProgress) => void>> = new Map();

    /**
     * Crea un nuovo job
     */
    createJob(type: JobProgress['type'], metadata?: Record<string, any>): string {
        const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const job: JobProgress = {
            id,
            type,
            status: 'pending',
            progress: 0,
            message: 'In attesa...',
            startedAt: new Date(),
            metadata
        };

        this.jobs.set(id, job);
        this.notifyListeners(id, job);

        // Auto-cleanup dopo 1 ora
        setTimeout(() => {
            this.jobs.delete(id);
            this.listeners.delete(id);
        }, 60 * 60 * 1000);

        return id;
    }

    /**
     * Avvia un job
     */
    startJob(id: string, message: string = 'Avvio in corso...'): void {
        const job = this.jobs.get(id);
        if (job) {
            job.status = 'running';
            job.message = message;
            job.progress = 0;
            this.notifyListeners(id, job);
        }
    }

    /**
     * Aggiorna lo stato di un job
     */
    updateProgress(id: string, progress: number, message?: string): void {
        const job = this.jobs.get(id);
        if (job) {
            job.progress = Math.min(100, Math.max(0, progress));
            if (message) job.message = message;
            this.notifyListeners(id, job);
        }
    }

    /**
     * Segna un job come completato
     */
    completeJob(id: string, message: string = 'Operazione completata'): void {
        const job = this.jobs.get(id);
        if (job) {
            job.status = 'completed';
            job.progress = 100;
            job.message = message;
            job.completedAt = new Date();
            this.notifyListeners(id, job);
        }
    }

    /**
     * Segna un job come fallito
     */
    failJob(id: string, error: string): void {
        const job = this.jobs.get(id);
        if (job) {
            job.status = 'failed';
            job.error = error;
            job.message = `Errore: ${error}`;
            job.completedAt = new Date();
            this.notifyListeners(id, job);
        }
    }

    /**
     * Ottieni lo stato di un job
     */
    getJob(id: string): JobProgress | undefined {
        return this.jobs.get(id);
    }

    /**
     * Ottieni tutti i job per utente (basato su metadata.utenteId)
     */
    getJobsByUser(utenteId: number): JobProgress[] {
        return Array.from(this.jobs.values())
            .filter(job => job.metadata?.utenteId === utenteId)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }

    /**
     * Ottieni tutti i job attivi
     */
    getActiveJobs(): JobProgress[] {
        return Array.from(this.jobs.values())
            .filter(job => job.status === 'running' || job.status === 'pending');
    }

    /**
     * Sottoscrivi agli aggiornamenti di un job
     */
    subscribe(id: string, callback: (job: JobProgress) => void): () => void {
        if (!this.listeners.has(id)) {
            this.listeners.set(id, new Set());
        }
        this.listeners.get(id)!.add(callback);

        // Invia lo stato attuale immediatamente
        const job = this.jobs.get(id);
        if (job) {
            callback(job);
        }

        // Ritorna funzione di unsubscribe
        return () => {
            this.listeners.get(id)?.delete(callback);
        };
    }

    /**
     * Notifica tutti i listener di un job
     */
    private notifyListeners(id: string, job: JobProgress): void {
        const listeners = this.listeners.get(id);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(job);
                } catch (e) {
                    console.error('Error in job listener:', e);
                }
            });
        }
    }
}

// Singleton instance
export const jobProgressManager = new JobProgressManager();

export { JobProgress };
