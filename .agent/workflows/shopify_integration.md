---
description: Shopify Integration Workflow
---

# Shopify Integration Workflow

This workflow describes how to configure and use the Shopify integration to export products with enriched data.

## 1. Configuration

1.  Navigate to the **Integrazioni** page.
2.  In the **Shopify Export** section, enter your:
    *   **Shop URL**: e.g., `your-shop.myshopify.com`
    *   **Access Token**: Your Admin API Access Token (shpat_...)
3.  Click **Salva**.

## 2. Data Preparation & Preview

Before syncing, you can preview the data that will be sent to Shopify.

1.  Ensure you have imported a price list and calculated selling prices.
2.  (Optional) Run **Icecat Enrichment** to get descriptions and specs.
3.  Click **Sincronizza con Shopify**.
    *   This process first **prepares** the data in the local database.
    *   It generates:
        *   **Handle**: Unique slug (`name-ean`).
        *   **Description**: HTML with specs table and PDF link.
        *   **Tags**: Filters for Brand, RAM, CPU, etc.
        *   **Prices**: Selling price and Compare-at price.
4.  If the sync fails (e.g., invalid token), the **Preview Table** will still be updated with the prepared data.
5.  Review the **Anteprima Output** table to verify handles, prices, and presence of descriptions/images.

## 3. Synchronization

1.  If the preview looks good, ensure your Token is valid.
2.  Click **Sincronizza con Shopify** again.
3.  The system will push products to Shopify in batches.
4.  Status will update to `uploaded` or `error`.

## Troubleshooting

*   **Error 500 / Malformed UTF-8**: Your stored token might be corrupt. Re-enter the token and save.
*   **Unique Constraint Failed**: The system now automatically appends the EAN to the handle to prevent this.
*   **Connection Error**: Refresh the page if the server restarted.
