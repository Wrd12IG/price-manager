import { ProductFilterService } from '../services/ProductFilterService';

async function testBrandMatching() {
    const service = new ProductFilterService();

    // Test cases
    const testCases = [
        { product: 'ASUS', rule: 'ASUS', expected: true },
        { product: 'ASUSTOR', rule: 'ASUS', expected: false },
        { product: 'ASUSTEK', rule: 'ASUS', expected: false },
        { product: 'ASUS ROG', rule: 'ASUS', expected: true },
        { product: 'ASUS', rule: 'ASUS ROG', expected: true },
        { product: 'ASUSTOR', rule: 'ASUSTEK', expected: false },
        { product: 'ASUS', rule: 'ASUSTEK', expected: false },
        { product: 'ASUSTEK', rule: 'ASUSTEK', expected: true },
    ];

    console.log('=== TEST BRAND MATCHING ===\n');

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        // @ts-ignore - accessing private method for testing
        const result = service['brandMatches'](test.product, test.rule);
        const status = result === test.expected ? '✅ PASS' : '❌ FAIL';

        if (result === test.expected) {
            passed++;
        } else {
            failed++;
        }

        console.log(`${status} | Product: "${test.product}" | Rule: "${test.rule}" | Expected: ${test.expected} | Got: ${result}`);
    }

    console.log(`\n=== RISULTATI ===`);
    console.log(`Passed: ${passed}/${testCases.length}`);
    console.log(`Failed: ${failed}/${testCases.length}`);

    process.exit(failed > 0 ? 1 : 0);
}

testBrandMatching();
