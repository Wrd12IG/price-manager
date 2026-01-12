# Mappatura Campi Shopify vs Ecommerce Price Manager

Questo documento descrive come i campi interni del sistema (`OutputShopify` e `MasterFile`) vengono mappati sui campi standard di importazione/esportazione Shopify.

## Tabella di Mappatura

| Campo Shopify (CSV Standard) | Campo Interno (`OutputShopify`) | Fonte Dati Originale | Note |
|------------------------------|---------------------------------|----------------------|------|
| **Handle** | `handle` | `MasterFile.nomeProdotto` + `ean` | Identificativo univoco (slug) |
| **Title** | `title` | `MasterFile.nomeProdotto` | Arricchito da Icecat se disponibile |
| **Body (HTML)** | `bodyHtml` | Generato | Include descrizione, tabella specifiche e link PDF |
| **Vendor** | `vendor` | `MasterFile.marca` | |
| **Type** | `productType` | `MasterFile.categoriaEcommerce` | |
| **Tags** | `tags` | Generato | Include Marca, Categoria, Feature principali (RAM, CPU, ecc.) |
| **Published** | - | - | Impostato a `true` (active) di default nel payload API |
| **Option1 Name** | - | - | Default: "Title" (per prodotti senza varianti) |
| **Option1 Value** | - | - | Default: "Default Title" |
| **Variant SKU** | `handle` | `MasterFile.skuSelezionato` | Attualmente mappato su `handle`. Modificabile per usare SKU fornitore. |
| **Variant Grams** | - | Icecat Specs (`weight`) | **Da implementare**: estrazione peso da `specificheJson` |
| **Variant Inventory Qty** | `variantInventoryQty` | `MasterFile.quantitaTotaleAggregata` | Somma giacenze fornitori |
| **Variant Price** | `variantPrice` | `MasterFile.prezzoVenditaCalcolato` | Calcolato con regole di markup |
| **Variant Compare At Price** | `variantCompareAtPrice` | - | Prezzo listino (se disponibile) o markup fittizio |
| **Variant Barcode** | - | `MasterFile.eanGtin` | **Da aggiungere**: il campo esiste nel DB ma va aggiunto all'export |
| **Image Src** | `immaginiUrls` | Icecat / Fornitore | JSON array di URL |
| **Image Alt Text** | - | `title` | Usiamo il titolo del prodotto |
| **SEO Title** | `title` | `title` | Uguale al titolo |
| **SEO Description** | `descrizioneBreve` | Icecat (`descrizioneBrave`) | |
| **Status** | - | - | `active` o `draft` in base alla logica di business |

## Note sull'Implementazione

- **Metafields**: I dati tecnici dettagliati (`specificheJson`) possono essere mappati su Metafields Shopify se necessario.
- **Immagini**: Il campo `immaginiUrls` contiene un JSON. Durante l'export verso Shopify (API), queste vengono iterate e caricate come media items.
- **Barcode/EAN**: È fortemente consigliato aggiungere il mapping del campo `Variant Barcode` con il nostro `eanGtin` per migliorare il matching su Google Shopping e altri canali.
