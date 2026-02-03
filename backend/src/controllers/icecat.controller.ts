// @ts-nocheck
import { Response } from 'express';
import { IcecatService } from '../services/IcecatService';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Controller per la gestione di Icecat - Multi-Tenant
 */

export const getConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  if (!utenteId) throw new AppError('Non autorizzato', 401);
  const config = await IcecatService.getConfig(utenteId);
  res.json({ success: true, data: config });
});

export const saveConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  if (!utenteId) throw new AppError('Non autorizzato', 401);
  const { username, password } = req.body;
  await IcecatService.saveConfig(utenteId, username, password);
  res.json({ success: true, message: 'Configurazione salvata' });
});

export const enrichProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  if (!utenteId) throw new AppError('Non autorizzato', 401);
  const result = await IcecatService.enrichMasterFile(utenteId);
  res.json({ success: true, message: 'Arricchimento completato', data: result });
});

export const getEnriched = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  if (!utenteId) throw new AppError('Non autorizzato', 401);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const result = await IcecatService.getEnrichedProducts(utenteId, page, limit);
  res.json({ success: true, data: result });
});

export const getProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  if (!utenteId) throw new AppError('Non autorizzato', 401);
  const progress = await IcecatService.getEnrichmentProgress(utenteId);
  res.json({ success: true, data: progress });
});

/**
 * Export CSV (Filtrato per Utente)
 */
export const exportCSV = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  const products = await prisma.masterFile.findMany({
    where: { utenteId },
    include: {
      fornitoreSelezionato: { select: { nomeFornitore: true } },
      marchio: { select: { nome: true } },
      categoria: { select: { nome: true } },
      datiIcecat: true
    },
    orderBy: { id: 'asc' }
  });

  const headers = [
    'ID', 'EAN/GTIN', 'SKU', 'Nome Prodotto', 'Prezzo Acquisto', 'Prezzo Vendita',
    'Quantità', 'Fornitore', 'Marchio', 'Categoria', 'Data Aggiornamento',
    'Icecat Arricchito'
  ];

  const escapeCsvValue = (value: string): string => {
    if (!value) return '';
    const str = String(value);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = products.map(p => [
    p.id,
    p.eanGtin,
    p.skuSelezionato,
    escapeCsvValue(p.nomeProdotto || ''),
    p.prezzoAcquistoMigliore,
    p.prezzoVenditaCalcolato,
    p.quantitaTotaleAggregata,
    escapeCsvValue(p.fornitoreSelezionato.nomeFornitore),
    escapeCsvValue(p.marchio?.nome || ''),
    escapeCsvValue(p.categoria?.nome || ''),
    p.dataUltimoAggiornamento.toISOString(),
    p.datiIcecat ? 'Sì' : 'No'
  ]);

  const csv = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=masterfile_enriched.csv');
  res.send('\uFEFF' + csv);
});

/**
 * Export JSON (Filtrato per Utente)
 */
export const exportJSON = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  const products = await prisma.masterFile.findMany({
    where: { utenteId },
    include: {
      fornitoreSelezionato: { select: { nomeFornitore: true } },
      marchio: { select: { nome: true } },
      categoria: { select: { nome: true } },
      datiIcecat: true
    }
  });

  res.json(products);
});

/**
 * Export HTML (Filtrato per Utente)
 */
export const exportHTML = asyncHandler(async (req: AuthRequest, res: Response) => {
  const utenteId = req.utenteId;
  const products = await prisma.masterFile.findMany({
    where: { utenteId },
    include: {
      fornitoreSelezionato: { select: { nomeFornitore: true } },
      marchio: { select: { nome: true } },
      categoria: { select: { nome: true } },
      datiIcecat: true
    },
    orderBy: { id: 'asc' }
  });

  const enrichedCount = products.filter(p => p.datiIcecat).length;
  const percentage = products.length > 0 ? Math.round((enrichedCount / products.length) * 100) : 0;

  let html = `<html><head><title>Report Utente ${utenteId}</title></head><body>`;
  html += `<h1>Report Master File</h1><p>Prodotti: ${products.length} (Arricchiti: ${enrichedCount} - ${percentage}%)</p>`;
  html += `<table border="1"><thead><tr><th>EAN</th><th>Nome</th><th>Prezzo</th><th>Icecat</th></tr></thead><tbody>`;

  products.forEach(p => {
    html += `<tr><td>${p.eanGtin}</td><td>${p.nomeProdotto}</td><td>${p.prezzoVenditaCalcolato}</td><td>${p.datiIcecat ? 'SI' : 'NO'}</td></tr>`;
  });

  html += `</tbody></table></body></html>`;
  res.send(html);
});
