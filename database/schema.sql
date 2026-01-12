-- E-commerce Price Management System - Database Schema
-- PostgreSQL 12+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: fornitori (Suppliers)
-- ============================================================================
CREATE TABLE fornitori (
    id_fornitore SERIAL PRIMARY KEY,
    nome_fornitore VARCHAR(255) NOT NULL UNIQUE,
    url_listino TEXT,
    formato_file VARCHAR(50) CHECK (formato_file IN ('CSV', 'EXCEL', 'XML', 'JSON', 'TSV')),
    encoding VARCHAR(20) DEFAULT 'UTF-8',
    separatore_csv VARCHAR(5) DEFAULT ';',
    tipo_accesso VARCHAR(50) CHECK (tipo_accesso IN ('URL_DIRETTO', 'HTTP_AUTH', 'FTP', 'SFTP', 'API_REST')),
    username_accesso VARCHAR(255),
    password_accesso TEXT, -- Encrypted
    credenziali_extra JSONB, -- For API keys, tokens, etc.
    attivo BOOLEAN DEFAULT true,
    ultima_sincronizzazione TIMESTAMP,
    frequenza_aggiornamento VARCHAR(50) DEFAULT 'GIORNALIERA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fornitori_attivo ON fornitori(attivo);

-- ============================================================================
-- TABLE: mappatura_campi (Field Mappings)
-- ============================================================================
CREATE TABLE mappatura_campi (
    id_mappatura SERIAL PRIMARY KEY,
    id_fornitore INTEGER NOT NULL REFERENCES fornitori(id_fornitore) ON DELETE CASCADE,
    campo_originale VARCHAR(255) NOT NULL,
    campo_standard VARCHAR(255) NOT NULL CHECK (campo_standard IN (
        'SKU_Fornitore', 'EAN_GTIN', 'Descrizione_Prodotto', 'Prezzo_Acquisto',
        'Quantita', 'Categoria_Fornitore', 'Marca', 'Peso', 'Dimensioni', 'Altro'
    )),
    tipo_dato VARCHAR(50) DEFAULT 'STRING',
    trasformazione_richiesta VARCHAR(100), -- e.g., 'trim', 'uppercase', 'normalize_ean'
    ordine_priorita INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_fornitore, campo_originale)
);

CREATE INDEX idx_mappatura_campi_fornitore ON mappatura_campi(id_fornitore);

-- ============================================================================
-- TABLE: mappatura_categorie (Category Mappings)
-- ============================================================================
CREATE TABLE mappatura_categorie (
    id_mappatura_cat SERIAL PRIMARY KEY,
    id_fornitore INTEGER NOT NULL REFERENCES fornitori(id_fornitore) ON DELETE CASCADE,
    categoria_fornitore VARCHAR(500) NOT NULL,
    categoria_ecommerce VARCHAR(500) NOT NULL,
    priorita INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_fornitore, categoria_fornitore)
);

CREATE INDEX idx_mappatura_categorie_fornitore ON mappatura_categorie(id_fornitore);

-- ============================================================================
-- TABLE: regole_markup (Pricing Rules)
-- ============================================================================
CREATE TABLE regole_markup (
    id_regola SERIAL PRIMARY KEY,
    tipo_regola VARCHAR(50) NOT NULL CHECK (tipo_regola IN ('PRODOTTO_SPECIFICO', 'MARCA', 'CATEGORIA', 'DEFAULT')),
    riferimento VARCHAR(500), -- SKU, brand name, or category path (NULL for DEFAULT)
    markup_percentuale DECIMAL(5,2) DEFAULT 0.00, -- e.g., 20.00 for 20%
    markup_fisso DECIMAL(10,2) DEFAULT 0.00, -- Fixed amount to add
    costo_spedizione DECIMAL(10,2) DEFAULT 0.00,
    priorita INTEGER NOT NULL, -- 1=highest (product), 2=brand, 3=category, 4=default
    data_inizio_validita DATE,
    data_fine_validita DATE,
    attivo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (priorita BETWEEN 1 AND 4)
);

CREATE INDEX idx_regole_markup_tipo ON regole_markup(tipo_regola, attivo);
CREATE INDEX idx_regole_markup_priorita ON regole_markup(priorita);

-- ============================================================================
-- TABLE: listini_raw (Raw Supplier Data)
-- ============================================================================
CREATE TABLE listini_raw (
    id_record SERIAL PRIMARY KEY,
    id_fornitore INTEGER NOT NULL REFERENCES fornitori(id_fornitore) ON DELETE CASCADE,
    data_importazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sku_fornitore VARCHAR(255),
    ean_gtin VARCHAR(50),
    descrizione_originale TEXT,
    prezzo_acquisto DECIMAL(10,2),
    quantita_disponibile INTEGER DEFAULT 0,
    categoria_fornitore VARCHAR(500),
    marca VARCHAR(255),
    altri_campi JSONB, -- Flexible storage for additional fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listini_raw_fornitore ON listini_raw(id_fornitore);
CREATE INDEX idx_listini_raw_ean ON listini_raw(ean_gtin);
CREATE INDEX idx_listini_raw_sku ON listini_raw(sku_fornitore);
CREATE INDEX idx_listini_raw_importazione ON listini_raw(data_importazione);

-- ============================================================================
-- TABLE: master_file (Consolidated Product Catalog)
-- ============================================================================
CREATE TABLE master_file (
    id_master SERIAL PRIMARY KEY,
    ean_gtin VARCHAR(50) NOT NULL UNIQUE, -- Primary product identifier
    sku_selezionato VARCHAR(255),
    id_fornitore_selezionato INTEGER REFERENCES fornitori(id_fornitore),
    prezzo_acquisto_migliore DECIMAL(10,2),
    prezzo_vendita_calcolato DECIMAL(10,2),
    quantita_totale_aggregata INTEGER DEFAULT 0,
    categoria_ecommerce VARCHAR(500),
    marca VARCHAR(255),
    descrizione_base TEXT,
    data_ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_master_ean ON master_file(ean_gtin);
CREATE INDEX idx_master_categoria ON master_file(categoria_ecommerce);
CREATE INDEX idx_master_marca ON master_file(marca);

-- ============================================================================
-- TABLE: dati_icecat (ICecat Enrichment Data)
-- ============================================================================
CREATE TABLE dati_icecat (
    id_icecat SERIAL PRIMARY KEY,
    ean_gtin VARCHAR(50) NOT NULL UNIQUE,
    descrizione_breve TEXT,
    descrizione_lunga TEXT,
    specifiche_tecniche JSONB,
    url_immagini JSONB, -- Array of image URLs
    url_scheda_pdf TEXT,
    categoria_icecat VARCHAR(500),
    data_scaricamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dati_icecat_ean ON dati_icecat(ean_gtin);

-- ============================================================================
-- TABLE: output_shopify (Shopify Export Data)
-- ============================================================================
CREATE TABLE output_shopify (
    id_output SERIAL PRIMARY KEY,
    id_master INTEGER NOT NULL REFERENCES master_file(id_master) ON DELETE CASCADE,
    handle VARCHAR(500) UNIQUE, -- Shopify URL handle
    title TEXT NOT NULL,
    body_html TEXT,
    vendor VARCHAR(255),
    product_type VARCHAR(255),
    tags TEXT, -- Comma-separated tags
    variant_sku VARCHAR(255),
    variant_price DECIMAL(10,2),
    variant_compare_at_price DECIMAL(10,2),
    variant_inventory_qty INTEGER DEFAULT 0,
    variant_inventory_policy VARCHAR(50) DEFAULT 'deny',
    variant_fulfillment_service VARCHAR(50) DEFAULT 'manual',
    variant_requires_shipping BOOLEAN DEFAULT true,
    variant_taxable BOOLEAN DEFAULT true,
    variant_barcode VARCHAR(50),
    immagini_urls JSONB, -- Array of image URLs
    seo_title VARCHAR(255),
    seo_description TEXT,
    data_generazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stato_caricamento VARCHAR(50) DEFAULT 'pending' CHECK (stato_caricamento IN ('pending', 'uploaded', 'error')),
    errore_caricamento TEXT,
    shopify_product_id BIGINT, -- Shopify's product ID after upload
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_output_shopify_master ON output_shopify(id_master);
CREATE INDEX idx_output_shopify_stato ON output_shopify(stato_caricamento);
CREATE INDEX idx_output_shopify_handle ON output_shopify(handle);

-- ============================================================================
-- TABLE: log_elaborazioni (Process Execution Logs)
-- ============================================================================
CREATE TABLE log_elaborazioni (
    id_log SERIAL PRIMARY KEY,
    data_esecuzione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fase_processo VARCHAR(100) NOT NULL CHECK (fase_processo IN (
        'INGESTIONE', 'NORMALIZZAZIONE', 'CONSOLIDAMENTO', 
        'ARRICCHIMENTO_ICECAT', 'ARRICCHIMENTO_AI', 'CALCOLO_PREZZI', 
        'GENERAZIONE_OUTPUT', 'CARICAMENTO_SHOPIFY', 'COMPLETO'
    )),
    stato VARCHAR(50) NOT NULL CHECK (stato IN ('success', 'warning', 'error', 'running')),
    dettagli JSONB,
    durata_secondi INTEGER,
    prodotti_elaborati INTEGER DEFAULT 0,
    errori_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_data ON log_elaborazioni(data_esecuzione DESC);
CREATE INDEX idx_log_fase ON log_elaborazioni(fase_processo);
CREATE INDEX idx_log_stato ON log_elaborazioni(stato);

-- ============================================================================
-- TABLE: configurazione_sistema (System Configuration)
-- ============================================================================
CREATE TABLE configurazione_sistema (
    id_config SERIAL PRIMARY KEY,
    chiave VARCHAR(100) NOT NULL UNIQUE,
    valore TEXT,
    valore_json JSONB,
    tipo_dato VARCHAR(50) DEFAULT 'STRING',
    categoria VARCHAR(100), -- e.g., 'ICECAT', 'AI', 'SHOPIFY', 'SCHEDULER'
    descrizione TEXT,
    encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_config_categoria ON configurazione_sistema(categoria);

-- ============================================================================
-- TABLE: prodotti_ai_enhanced (AI-Enhanced Product Descriptions)
-- ============================================================================
CREATE TABLE prodotti_ai_enhanced (
    id_ai_enhanced SERIAL PRIMARY KEY,
    ean_gtin VARCHAR(50) NOT NULL UNIQUE,
    descrizione_originale TEXT,
    descrizione_ai_generata TEXT,
    titolo_ottimizzato TEXT,
    features_estratte JSONB,
    prompt_utilizzato TEXT,
    ai_provider VARCHAR(50), -- 'OPENAI', 'CLAUDE', 'GEMINI'
    costo_elaborazione DECIMAL(10,4),
    data_generazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_enhanced_ean ON prodotti_ai_enhanced(ean_gtin);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_fornitori_updated_at BEFORE UPDATE ON fornitori
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mappatura_campi_updated_at BEFORE UPDATE ON mappatura_campi
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mappatura_categorie_updated_at BEFORE UPDATE ON mappatura_categorie
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regole_markup_updated_at BEFORE UPDATE ON regole_markup
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_master_file_updated_at BEFORE UPDATE ON master_file
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dati_icecat_updated_at BEFORE UPDATE ON dati_icecat
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_output_shopify_updated_at BEFORE UPDATE ON output_shopify
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurazione_sistema_updated_at BEFORE UPDATE ON configurazione_sistema
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prodotti_ai_enhanced_updated_at BEFORE UPDATE ON prodotti_ai_enhanced
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default pricing rule
INSERT INTO regole_markup (tipo_regola, riferimento, markup_percentuale, markup_fisso, costo_spedizione, priorita, attivo)
VALUES ('DEFAULT', NULL, 20.00, 0.00, 3.00, 4, true);

-- Insert default system configurations
INSERT INTO configurazione_sistema (chiave, valore, categoria, descrizione) VALUES
('ICECAT_USERNAME', '', 'ICECAT', 'ICecat API Username'),
('ICECAT_API_KEY', '', 'ICECAT', 'ICecat API Key'),
('ICECAT_LANGUAGE', 'IT', 'ICECAT', 'Preferred language for ICecat data'),
('ICECAT_FALLBACK_LANGUAGE', 'EN', 'ICECAT', 'Fallback language if preferred not available'),
('AI_PROVIDER', 'OPENAI', 'AI', 'AI Provider: OPENAI, CLAUDE, or GEMINI'),
('AI_API_KEY', '', 'AI', 'AI Provider API Key'),
('AI_MODEL', 'gpt-4', 'AI', 'AI Model to use'),
('SHOPIFY_SHOP_URL', '', 'SHOPIFY', 'Shopify shop URL (e.g., yourshop.myshopify.com)'),
('SHOPIFY_API_KEY', '', 'SHOPIFY', 'Shopify API Key'),
('SHOPIFY_API_PASSWORD', '', 'SHOPIFY', 'Shopify API Password'),
('SHOPIFY_EXPORT_METHOD', 'CSV', 'SHOPIFY', 'Export method: CSV or API'),
('SCHEDULER_FREQUENCY', 'DAILY', 'SCHEDULER', 'Execution frequency'),
('SCHEDULER_TIME', '02:00', 'SCHEDULER', 'Execution time (HH:MM)'),
('SCHEDULER_ENABLED', 'false', 'SCHEDULER', 'Enable automatic execution'),
('NOTIFICATION_EMAIL', '', 'NOTIFICATION', 'Email for notifications'),
('NOTIFICATION_SLACK_WEBHOOK', '', 'NOTIFICATION', 'Slack webhook URL'),
('NOTIFICATION_TELEGRAM_BOT_TOKEN', '', 'NOTIFICATION', 'Telegram bot token'),
('NOTIFICATION_TELEGRAM_CHAT_ID', '', 'NOTIFICATION', 'Telegram chat ID');

COMMENT ON TABLE fornitori IS 'Supplier configurations and credentials';
COMMENT ON TABLE mappatura_campi IS 'Field mapping rules from supplier format to standard format';
COMMENT ON TABLE mappatura_categorie IS 'Category mapping from supplier categories to e-commerce categories';
COMMENT ON TABLE regole_markup IS 'Pricing rules with priority system';
COMMENT ON TABLE listini_raw IS 'Raw imported supplier price list data';
COMMENT ON TABLE master_file IS 'Consolidated product catalog with best prices';
COMMENT ON TABLE dati_icecat IS 'Product enrichment data from ICecat API';
COMMENT ON TABLE output_shopify IS 'Generated Shopify export data';
COMMENT ON TABLE log_elaborazioni IS 'Process execution audit logs';
COMMENT ON TABLE configurazione_sistema IS 'System-wide configuration settings';
COMMENT ON TABLE prodotti_ai_enhanced IS 'AI-enhanced product descriptions and content';
