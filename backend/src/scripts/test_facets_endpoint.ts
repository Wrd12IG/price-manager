import axios from 'axios';

async function testFacetsEndpoint() {
    const API_URL = 'http://localhost:3000/api/filters/facets';

    try {
        console.log('🧪 TEST ENDPOINT FACETS\n');

        // Test 1: Nessun filtro (dovrebbe tornare tutto)
        console.log('1. Test senza filtri...');
        const res1 = await axios.get(API_URL);
        console.log(`   Brands: ${res1.data.data.brands.length}, Categories: ${res1.data.data.categories.length}`);

        // Prendi una marca e una categoria esistenti per i test successivi
        const testBrand = res1.data.data.brands.find((b: any) => b.count > 0)?.value || 'ASUS';
        const testCategory = res1.data.data.categories.find((c: any) => c.count > 0)?.value || 'NOTEBOOK';

        console.log(`   Usando per test: Brand=${testBrand}, Category=${testCategory}\n`);

        // Test 2: Filtro per Brand (dovrebbe mantenere le altre marche visibili)
        console.log(`2. Test filtro Brand=${testBrand}...`);
        const res2 = await axios.get(`${API_URL}?brands[]=${encodeURIComponent(testBrand)}`);

        const brandInResult = res2.data.data.brands.find((b: any) => b.value === testBrand);
        const otherBrands = res2.data.data.brands.filter((b: any) => b.value !== testBrand && b.count > 0);

        console.log(`   Brand selezionato (${testBrand}): count=${brandInResult?.count}`);
        console.log(`   Altre marche con count > 0: ${otherBrands.length}`);

        if (otherBrands.length > 0) {
            console.log('   ✅ SUCCESSO: Le altre marche sono ancora visibili!');
        } else {
            console.log('   ❌ FALLIMENTO: Le altre marche sono sparite.');
        }

        // Test 3: Filtro per Brand + Categoria
        console.log(`\n3. Test filtro Brand=${testBrand} + Category=${testCategory}...`);
        const res3 = await axios.get(`${API_URL}?brands[]=${encodeURIComponent(testBrand)}&categories[]=${encodeURIComponent(testCategory)}`);

        const catInResult = res3.data.data.categories.find((c: any) => c.value === testCategory);
        const otherCats = res3.data.data.categories.filter((c: any) => c.value !== testCategory && c.count > 0);

        console.log(`   Categoria selezionata (${testCategory}): count=${catInResult?.count}`);
        console.log(`   Altre categorie con count > 0: ${otherCats.length}`);

        if (otherCats.length > 0) {
            console.log('   ✅ SUCCESSO: Le altre categorie sono ancora visibili!');
        } else {
            console.log('   ❌ FALLIMENTO: Le altre categorie sono sparite.');
        }

    } catch (error: any) {
        console.error('❌ Errore durante il test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testFacetsEndpoint();
