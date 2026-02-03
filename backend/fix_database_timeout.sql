-- ============================================================================
-- FIX DATABASE TIMEOUT
-- ============================================================================
-- 
-- PROBLEMA: Query Prisma vanno in timeout durante l'import listini
-- ERRORE: PostgresError { code: "57014", message: "canceling statement due to statement timeout" }
-- 
-- SOLUZIONE: Aumentare il timeout a 30 minuti
-- ============================================================================

-- Opzione 1: Aumenta timeout per tutto il database (RACCOMANDATO)
-- Sostituisci 'your_database_name' con il nome reale del tuo database
ALTER DATABASE your_database_name SET statement_timeout = '30min';

-- Opzione 2: Aumenta timeout solo per la connessione corrente (TEMPORANEO)
-- Esegui questo prima di ogni operazione lunga
SET statement_timeout = '1800000'; -- 30 minuti in millisecondi

-- Opzione 3: Aumenta timeout per un ruolo specifico  
-- Sostituisci 'your_user' con il nome utente PostgreSQL
ALTER ROLE your_user SET statement_timeout = '30min';

-- ============================================================================
-- VERIFICA
-- ============================================================================

-- Controlla il timeout attuale
SHOW statement_timeout;

-- Controlla le impostazioni del database
SELECT name, setting, unit 
FROM pg_settings 
WHERE name = 'statement_timeout';

-- ============================================================================
-- ROLLBACK (se necessario)
-- ============================================================================

-- Per tornare al default (disabilita timeout):
-- ALTER DATABASE your_database_name RESET statement_timeout;
-- ALTER ROLE your_user RESET statement_timeout;
