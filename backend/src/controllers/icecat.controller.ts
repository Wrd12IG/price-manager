import { Request, Response } from 'express';
import { IcecatService } from '../services/IcecatService';
import { asyncHandler } from '../middleware/errorHandler';
import prisma from '../config/database';

export const getConfig = asyncHandler(async (req: Request, res: Response) => {
    const config = await IcecatService.getConfig();
    res.json({ success: true, data: config });
});

export const saveConfig = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    await IcecatService.saveConfig(username, password);
    res.json({ success: true, message: 'Configurazione salvata' });
});

export const enrichProducts = asyncHandler(async (req: Request, res: Response) => {
    const result = await IcecatService.enrichMasterFile();
    res.json({ success: true, message: 'Arricchimento completato', data: result });
});

export const getEnriched = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await IcecatService.getEnrichedProducts(page, limit);
    res.json({ success: true, data: result });
});

export const getProgress = asyncHandler(async (req: Request, res: Response) => {
    const progress = await IcecatService.getEnrichmentProgress();
    res.json({ success: true, data: progress });
});

// Export CSV
export const exportCSV = asyncHandler(async (req: Request, res: Response) => {
    const products = await prisma.masterFile.findMany({
        include: {
            fornitoreSelezionato: { select: { nomeFornitore: true } },
            marchio: { select: { nome: true } },
            categoria: { select: { nome: true } },
            datiIcecat: true
        },
        orderBy: { id: 'asc' }
    });

    // Generate CSV
    const headers = [
        'ID', 'EAN/GTIN', 'SKU', 'Nome Prodotto', 'Prezzo Acquisto', 'Prezzo Vendita',
        'Quantità', 'Fornitore', 'Marchio', 'Categoria', 'Data Aggiornamento',
        'Icecat Arricchito', 'Icecat Descrizione Breve', 'Icecat Descrizione Lunga',
        'Icecat Specifiche Tecniche (JSON)', 'Icecat Immagini (JSON)',
        'Icecat Bullet Points (JSON)', 'Icecat Documenti (JSON)',
        'Icecat Lingua', 'Icecat Data Scaricamento'
    ];

    const escapeCsvValue = (value: string): string => {
        if (value.includes(';') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
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
        p.datiIcecat ? 'Sì' : 'No',
        escapeCsvValue(p.datiIcecat?.descrizioneBrave || ''),
        escapeCsvValue(p.datiIcecat?.descrizioneLunga || ''),
        escapeCsvValue(p.datiIcecat?.specificheTecnicheJson || ''),
        escapeCsvValue(p.datiIcecat?.urlImmaginiJson || ''),
        escapeCsvValue(p.datiIcecat?.bulletPointsJson || ''),
        escapeCsvValue(p.datiIcecat?.documentiJson || ''),
        p.datiIcecat?.linguaOriginale || '',
        p.datiIcecat?.dataScaricamento ? p.datiIcecat.dataScaricamento.toISOString() : ''
    ]);

    const csv = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=masterfile_enriched.csv');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support
});

// Export JSON
export const exportJSON = asyncHandler(async (req: Request, res: Response) => {
    const products = await prisma.masterFile.findMany({
        include: {
            fornitoreSelezionato: { select: { nomeFornitore: true } },
            marchio: { select: { nome: true } },
            categoria: { select: { nome: true } },
            datiIcecat: true
        },
        orderBy: { id: 'asc' }
    });

    const enrichedProducts = products.map(p => ({
        id: p.id,
        eanGtin: p.eanGtin,
        skuSelezionato: p.skuSelezionato,
        nomeProdotto: p.nomeProdotto,
        prezzoAcquistoMigliore: p.prezzoAcquistoMigliore,
        prezzoVenditaCalcolato: p.prezzoVenditaCalcolato,
        quantitaTotaleAggregata: p.quantitaTotaleAggregata,
        fornitoreSelezionato: p.fornitoreSelezionato.nomeFornitore,
        marchio: p.marchio?.nome || null,
        categoria: p.categoria?.nome || null,
        dataUltimoAggiornamento: p.dataUltimoAggiornamento,
        icecatEnriched: !!p.datiIcecat,
        icecatDescrizioneBrave: p.datiIcecat?.descrizioneBrave || null,
        icecatDescrizioneLunga: p.datiIcecat?.descrizioneLunga || null,
        icecatSpecificheTecniche: p.datiIcecat?.specificheTecnicheJson || null,
        icecatImmagini: p.datiIcecat?.urlImmaginiJson || null,
        icecatBulletPoints: p.datiIcecat?.bulletPointsJson || null,
        icecatDocumenti: p.datiIcecat?.documentiJson || null,
        icecatLingua: p.datiIcecat?.linguaOriginale || null,
        icecatDataScaricamento: p.datiIcecat?.dataScaricamento || null
    }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=masterfile_enriched.json');
    res.json(enrichedProducts);
});

// Export HTML
export const exportHTML = asyncHandler(async (req: Request, res: Response) => {
    const products = await prisma.masterFile.findMany({
        include: {
            fornitoreSelezionato: { select: { nomeFornitore: true } },
            marchio: { select: { nome: true } },
            categoria: { select: { nome: true } },
            datiIcecat: true
        },
        orderBy: { id: 'asc' }
    });

    const enrichedCount = products.filter(p => p.datiIcecat).length;
    const notEnrichedCount = products.length - enrichedCount;
    const percentage = products.length > 0 ? Math.round((enrichedCount / products.length) * 100) : 0;

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Master File Arricchito - Icecat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 { font-size: 2.5rem; margin-bottom: 10px; font-weight: 700; }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      padding: 40px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 15px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      text-align: center;
      transition: transform 0.3s ease;
    }
    .stat-card:hover { transform: translateY(-5px); }
    .stat-card .number { font-size: 2.5rem; font-weight: 700; color: #667eea; margin-bottom: 10px; }
    .stat-card .label { font-size: 1rem; color: #6c757d; text-transform: uppercase; letter-spacing: 1px; }
    .table-container { padding: 40px; overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    thead { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td { padding: 12px 15px; border-bottom: 1px solid #e9ecef; font-size: 0.9rem; }
    tbody tr:hover { background: #f8f9fa; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Master File Arricchito</h1>
      <p>Dati completi con arricchimento Icecat</p>
    </div>
    <div class="stats">
      <div class="stat-card">
        <div class="number">${products.length}</div>
        <div class="label">Prodotti Totali</div>
      </div>
      <div class="stat-card">
        <div class="number">${enrichedCount}</div>
        <div class="label">Arricchiti Icecat</div>
      </div>
      <div class="stat-card">
        <div class="number">${notEnrichedCount}</div>
        <div class="label">Non Arricchiti</div>
      </div>
      <div class="stat-card">
        <div class="number">${percentage}%</div>
        <div class="label">Copertura</div>
      </div>
    </div>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>EAN</th>
            <th>Prodotto</th>
            <th>Marchio</th>
            <th>Categoria</th>
            <th>Prezzo Vendita</th>
            <th>Fornitore</th>
            <th>Icecat</th>
            <th>Immagini</th>
            <th>Specifiche</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
        const images = p.datiIcecat?.urlImmaginiJson ? JSON.parse(p.datiIcecat.urlImmaginiJson) : [];
        const specs = p.datiIcecat?.specificheTecnicheJson ? JSON.parse(p.datiIcecat.specificheTecnicheJson) : [];
        return `
              <tr>
                <td>${p.id}</td>
                <td>${p.eanGtin}</td>
                <td><strong>${p.nomeProdotto || 'N/D'}</strong></td>
                <td>${p.marchio?.nome || 'N/D'}</td>
                <td>${p.categoria?.nome || 'N/D'}</td>
                <td><strong>€${p.prezzoVenditaCalcolato.toFixed(2)}</strong></td>
                <td>${p.fornitoreSelezionato.nomeFornitore}</td>
                <td>
                  <span class="badge ${p.datiIcecat ? 'badge-success' : 'badge-warning'}">
                    ${p.datiIcecat ? '✓ Sì' : '✗ No'}
                  </span>
                </td>
                <td>${images.length} foto</td>
                <td>${specs.length} specifiche</td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

