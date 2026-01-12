
import prisma from './src/config/database';

async function cleanupNesting() {
    try {
        console.log('Starting cleanup of nested HTML descriptions...');

        // 1. Check OutputShopify
        const outputProducts = await prisma.outputShopify.findMany({
            where: {
                bodyHtml: { contains: 'product-description' }
            }
        });

        console.log(`Checking ${outputProducts.length} products in OutputShopify...`);
        let fixedOutput = 0;

        for (const p of outputProducts) {
            if (!p.bodyHtml) continue;

            // Check if there are multiple wrappers
            const matches = p.bodyHtml.match(/class="product-description"/g);
            if (matches && matches.length > 1) {
                // Simplest way to unwrap: take the inner text of the first wrapper or just clean it
                // Since we know the structure, we can try to find the innermost one or just strip all but one.
                // But a safer way is to just use regex to remove the inner wrappers.

                // Let's use a more surgical approach: if we see the pattern of our bug
                // <div class="product-description" ...>...<div class="product-description" ...>

                let cleaned = p.bodyHtml;
                while (cleaned.match(/<div class="product-description"[^>]*>[\s\S]*<div class="product-description"/)) {
                    // This is complex for regex. Let's try to just find the content between the first 
                    // <p ...> and </p> that contains the nested div.

                    // Actually, let's just use a string split approach to take the deepest content
                    const parts = cleaned.split(/<div class="product-description"[^>]*>/);
                    const lastPart = parts[parts.length - 1];
                    // Close the last part correctly by removing trailing </div>s and adding one back if needed
                    // This is also risky.

                    // Better: The bug adds <div class="product-description"> around the WHOLE content.
                    // So we can just remove the FIRST div and the LAST /div and see if it's still a product description.

                    const firstDivIndex = cleaned.indexOf('<div class="product-description"');
                    const lastDivIndex = cleaned.lastIndexOf('</div>');

                    if (firstDivIndex !== -1 && lastDivIndex !== -1) {
                        const content = cleaned.substring(cleaned.indexOf('>', firstDivIndex) + 1, lastDivIndex).trim();
                        if (content.includes('class="product-description"')) {
                            cleaned = content;
                            continue;
                        }
                    }
                    break;
                }

                // Re-wrap once with standard style
                const finalHtml = `<div class="product-description" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 100%; margin: 0 auto;">${cleaned}</div>`;

                await prisma.outputShopify.update({
                    where: { id: p.id },
                    data: { bodyHtml: finalHtml }
                });
                fixedOutput++;
            }
        }
        console.log(`Fixed ${fixedOutput} products in OutputShopify.`);

        // 2. Check DatiIcecat (the source of the loop)
        const icecatProducts = await prisma.datiIcecat.findMany({
            where: {
                descrizioneLunga: { contains: 'product-description' }
            }
        });

        console.log(`Checking ${icecatProducts.length} records in DatiIcecat...`);
        let fixedIcecat = 0;

        for (const i of icecatProducts) {
            if (!i.descrizioneLunga) continue;

            const matches = i.descrizioneLunga.match(/class="product-description"/g);
            if (matches && matches.length > 1) {
                let cleaned = i.descrizioneLunga;
                while (cleaned.match(/<div class="product-description"[^>]*>[\s\S]*<div class="product-description"/)) {
                    const firstDivIndex = cleaned.indexOf('<div class="product-description"');
                    const lastDivIndex = cleaned.lastIndexOf('</div>');
                    if (firstDivIndex !== -1 && lastDivIndex !== -1) {
                        const content = cleaned.substring(cleaned.indexOf('>', firstDivIndex) + 1, lastDivIndex).trim();
                        if (content.includes('class="product-description"')) {
                            cleaned = content;
                            continue;
                        }
                    }
                    break;
                }
                // Re-wrap once
                const finalHtml = `<div class="product-description" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 100%; margin: 0 auto;">${cleaned}</div>`;

                await prisma.datiIcecat.update({
                    where: { id: i.id },
                    data: { descrizioneLunga: finalHtml }
                });
                fixedIcecat++;
            }
        }
        console.log(`Fixed ${fixedIcecat} records in DatiIcecat.`);

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupNesting();
