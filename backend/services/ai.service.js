const { OpenAI } = require('openai');
const { query } = require('../config/database');

/**
 * Get AI client based on configured provider
 * @returns {Promise<Object>} AI client and configuration
 */
async function getAIClient() {
    const configResult = await query(`
    SELECT chiave, valore FROM configurazione_sistema
    WHERE categoria = 'AI'
  `);

    const config = {};
    configResult.rows.forEach(row => {
        config[row.chiave] = row.valore;
    });

    const provider = config.AI_PROVIDER || 'OPENAI';
    const apiKey = config.AI_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('AI API key not configured');
    }

    switch (provider) {
        case 'OPENAI':
            return {
                client: new OpenAI({ apiKey }),
                model: config.AI_MODEL || 'gpt-4',
                provider: 'OPENAI'
            };

        case 'CLAUDE':
            const Anthropic = require('@anthropic-ai/sdk');
            return {
                client: new Anthropic({ apiKey }),
                model: config.AI_MODEL || 'claude-3-sonnet-20240229',
                provider: 'CLAUDE'
            };

        case 'GEMINI':
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            return {
                client: new GoogleGenerativeAI(apiKey),
                model: config.AI_MODEL || 'gemini-pro',
                provider: 'GEMINI'
            };

        default:
            throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * Enhance product description using AI
 * @param {string} ean - Product EAN
 * @param {string} originalDesc - Original description
 * @param {Object} specs - Product specifications
 * @returns {Promise<Object>} Enhanced content
 */
async function enhanceDescription(ean, originalDesc, specs = {}) {
    try {
        const { client, model, provider } = await getAIClient();

        // Get custom prompt from configuration
        const promptResult = await query(`
      SELECT valore FROM configurazione_sistema
      WHERE chiave = 'AI_PROMPT_TEMPLATE'
    `);

        const promptTemplate = promptResult.rows.length > 0
            ? promptResult.rows[0].valore
            : getDefaultPrompt();

        const prompt = promptTemplate
            .replace('{descrizione_icecat}', originalDesc || 'N/A')
            .replace('{specifiche_tecniche}', JSON.stringify(specs, null, 2));

        let enhancedText = '';
        let cost = 0;

        if (provider === 'OPENAI') {
            const response = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: 'Sei un copywriter esperto di e-commerce.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            enhancedText = response.choices[0].message.content;
            cost = calculateOpenAICost(response.usage, model);
        } else if (provider === 'CLAUDE') {
            const response = await client.messages.create({
                model,
                max_tokens: 500,
                messages: [{ role: 'user', content: prompt }]
            });

            enhancedText = response.content[0].text;
            cost = calculateClaudeCost(response.usage, model);
        } else if (provider === 'GEMINI') {
            const genModel = client.getGenerativeModel({ model });
            const result = await genModel.generateContent(prompt);
            enhancedText = result.response.text();
            cost = 0.01; // Approximate
        }

        // Save to database
        await query(`
      INSERT INTO prodotti_ai_enhanced (
        ean_gtin, descrizione_originale, descrizione_ai_generata,
        prompt_utilizzato, ai_provider, costo_elaborazione
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (ean_gtin) DO UPDATE SET
        descrizione_ai_generata = EXCLUDED.descrizione_ai_generata,
        prompt_utilizzato = EXCLUDED.prompt_utilizzato,
        ai_provider = EXCLUDED.ai_provider,
        costo_elaborazione = EXCLUDED.costo_elaborazione,
        updated_at = NOW()
    `, [ean, originalDesc, enhancedText, prompt, provider, cost]);

        return {
            ean,
            enhancedDescription: enhancedText,
            provider,
            cost
        };
    } catch (error) {
        console.error(`AI enhancement error for ${ean}:`, error.message);
        return null;
    }
}

/**
 * Default prompt template
 */
function getDefaultPrompt() {
    return `Sei un copywriter esperto di e-commerce.
Riscrivi questa descrizione prodotto in modo:
- Accattivante e persuasivo
- Ottimizzato SEO
- Evidenziando benefici chiave
- Lunghezza: 150-200 parole
- Tono: professionale ma accessibile

Descrizione originale: {descrizione_icecat}
Specifiche: {specifiche_tecniche}`;
}

/**
 * Calculate OpenAI cost
 */
function calculateOpenAICost(usage, model) {
    const rates = {
        'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
        'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 }
    };

    const rate = rates[model] || rates['gpt-4'];
    return (usage.prompt_tokens * rate.input) + (usage.completion_tokens * rate.output);
}

/**
 * Calculate Claude cost
 */
function calculateClaudeCost(usage, model) {
    const rate = { input: 0.015 / 1000, output: 0.075 / 1000 };
    return (usage.input_tokens * rate.input) + (usage.output_tokens * rate.output);
}

/**
 * Enhance all products
 */
async function enhanceAllProducts(limit = null) {
    console.log('Starting AI enhancement...');

    const startTime = Date.now();

    try {
        let queryText = `
      SELECT mf.ean_gtin, di.descrizione_lunga, di.specifiche_tecniche
      FROM master_file mf
      JOIN dati_icecat di ON mf.ean_gtin = di.ean_gtin
      LEFT JOIN prodotti_ai_enhanced pae ON mf.ean_gtin = pae.ean_gtin
      WHERE pae.ean_gtin IS NULL
    `;

        if (limit) {
            queryText += ` LIMIT ${limit}`;
        }

        const productsResult = await query(queryText);
        const products = productsResult.rows;

        console.log(`Enhancing ${products.length} products with AI`);

        let enhancedCount = 0;
        let totalCost = 0;

        for (const product of products) {
            const result = await enhanceDescription(
                product.ean_gtin,
                product.descrizione_lunga,
                product.specifiche_tecniche
            );

            if (result) {
                enhancedCount++;
                totalCost += result.cost;
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const duration = Date.now() - startTime;

        console.log(`AI enhancement complete: ${enhancedCount} products, €${totalCost.toFixed(2)} cost`);

        return {
            success: true,
            enhancedCount,
            totalCost,
            duration
        };
    } catch (error) {
        console.error('AI enhancement error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    enhanceDescription,
    enhanceAllProducts,
    getAIClient
};
