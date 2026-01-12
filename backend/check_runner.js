
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const runner = await prisma.fornitore.findFirst({
        where: { nomeFornitore: { contains: 'Runner' } }
    });
    console.log('RUNNER_DATA:', JSON.stringify(runner, null, 2));
    await prisma.$disconnect();
}

main();
