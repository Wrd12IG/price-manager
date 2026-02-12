-- Script SQL CORRETTO per resettare le password degli utenti
-- Password: admin123
-- Hash bcrypt (12 rounds)

-- QUERY CORRETTA - La tabella si chiama "utenti" (non "Utente")
UPDATE utenti 
SET "passwordHash" = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIVInCBVVC'
WHERE email IN (
    'sante.dormio@gmail.com',
    'roberto@wrdigital.it',
    'luca@wrdigital.it',
    'info@europccomputer.com'
);

-- Verifica gli utenti aggiornati
SELECT id, email, nome, ruolo 
FROM utenti
ORDER BY id;
