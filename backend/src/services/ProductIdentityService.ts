// @ts-nocheck
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { IcecatService } from './IcecatService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Servizio per il recupero dell'identità dei prodotti (Marca e Categoria)
 * Basato su EAN Identity First: usa EAN per interrogare Icecat o AI
 */
export class ProductIdentityService {

    private static genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '');

    /**
     * Recupera le identità mancanti per i prodotti nel Master File dell'utente
     */
    static async recoverIdentities(utenteId: number): Promise<{
        totalProcessed: number;
        recoveredIcecat: number;
        recoveredAI: number;
        failed: number;
    }> {
        logger.info(`🔍 [Utente ${utenteId}] Avvio recupero identità prodotti`);

        let recoveredIcecat = 0;
        let recoveredAI = 0;
        let failed = 0;

        try {
            // 1. Trova prodotti senza Marca o Categoria dell'utente
            const pendingProducts = await prisma.masterFile.findMany({
                where: {
                    utenteId,
                    OR: [{ marchioId: null }, { categoriaId: null }]
                },
                select: { id: true, eanGtin: true, nomeProdotto: true },
                take: 150
            });

            if (pendingProducts.length === 0) return { totalProcessed: 0, recoveredIcecat: 0, recoveredAI: 0, failed: 0 };

            // 2. Ottieni credenziali Icecat dell'utente
            const icecatConfig = await IcecatService.getConfig(utenteId);
            const icecatCreds = await this.getUserIcecatCreds(utenteId);
            const icecatEnabled = icecatConfig.configured && icecatCreds;

            // 3. Processa i prodotti
            for (const product of pendingProducts) {
                let identityFound = false;
                let foundBrand: string | null = null;
                let foundCategory: string | null = null;

                // TENTATIVO 1: ICECAT
                if (icecatEnabled && product.eanGtin) {
                    try {
                        const icecatData = await IcecatService.fetchProductData(product.eanGtin, icecatCreds!);
                        if (icecatData) {
                            foundBrand = icecatData.$?.Vendor || icecatData.Brand?.Name?.$?.Value || null;
                            foundCategory = icecatData.$?.Category_Name || icecatData.Category?.Name?.$?.Value || null;
                            if (foundBrand) {
                                identityFound = true;
                                recoveredIcecat++;
                            }
                        }
                    } catch (err) { }
                }

                // TENTATIVO 2: AI (Se Icecat fallisce)
                if (!identityFound && (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY)) {
                    try {
                        const aiIdentity = await this.askAIForIdentity(product.eanGtin || '', product.nomeProdotto || '');
                        if (aiIdentity?.brand) {
                            foundBrand = aiIdentity.brand;
                            foundCategory = aiIdentity.category || foundCategory;
                            identityFound = true;
                            recoveredAI++;
                        }
                    } catch (err) { }
                }

                if (identityFound && foundBrand) {
                    await this.updateProductIdentity(product.id, foundBrand, foundCategory);
                } else {
                    failed++;
                }
            }

            return { totalProcessed: pendingProducts.length, recoveredIcecat, recoveredAI, failed };

        } catch (error) {
            logger.error(`❌ Errore identity utente ${utenteId}:`, error);
            throw error;
        }
    }

    private static async getUserIcecatCreds(utenteId: number) {
        const configs = await prisma.configurazioneSistema.findMany({
            where: { utenteId, chiave: { in: ['icecat_username', 'icecat_password'] } }
        });
        const u = configs.find(c => c.chiave === 'icecat_username')?.valore;
        const p = configs.find(c => c.chiave === 'icecat_password')?.valore;

        if (!u || !p) return null;

        const CryptoJS = require('crypto-js');
        const encryptionKey = process.env.ENCRYPTION_KEY || '32-char-secret-key-for-aes-256';
        try {
            const dec = CryptoJS.AES.decrypt(p, encryptionKey).toString(CryptoJS.enc.Utf8);
            return { username: u, password: dec };
        } catch (e) { return null; }
    }

    private static async askAIForIdentity(ean: string, rawName: string): Promise<{ brand: string, category: string } | null> {
        const prompt = `Prodotto: ${rawName} (${ean}). Restituisci JSON: {"brand": "...", "category": "..."}`;
        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const match = text.match(/\{.*\}/s);
            return match ? JSON.parse(match[0]) : null;
        } catch (e) { return null; }
    }

    private static async updateProductIdentity(masterFileId: number, brandName: string, categoryName: string | null) {
        const brand = await prisma.marchio.upsert({
            where: { nome: brandName },
            create: { nome: brandName, normalizzato: brandName.toUpperCase(), attivo: true },
            update: {}
        });

        let catId = null;
        if (categoryName) {
            const cat = await prisma.categoria.upsert({
                where: { nome: categoryName },
                create: { nome: categoryName, normalizzato: categoryName.toUpperCase(), attivo: true },
                update: {}
            });
            catId = cat.id;
        }

        await prisma.masterFile.update({
            where: { id: masterFileId },
            data: { marchioId: brand.id, categoriaId: catId }
        });
    }
}
