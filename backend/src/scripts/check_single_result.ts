import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkResult() {
    try {
        const p = await prisma.outputShopify.findFirst({
            where: { masterFile: { eanGtin: '4711387252970' } }
        });

        if (p) {
            console.log('✅ Found product in OutputShopify');
            console.log(`Title: ${p.title}`);
            const metafields = JSON.parse(p.metafieldsJson || '[]');
            console.log(`Metafields count: ${metafields.length}`);
            console.log('Metafields list:');
            metafields.forEach((m: any) => console.log(`  - ${m.key}: ${m.value.substring(0, 30)}...`));
        } else {
            console.log('❌ Product not found in OutputShopify');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkResult();
