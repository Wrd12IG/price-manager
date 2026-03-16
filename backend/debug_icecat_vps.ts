import axios from 'axios';
import xml2js from 'xml2js';

async function check() {
    const url = 'https://data.icecat.biz/xml_s3/xml_server3.cgi?ean_upc=4711636250481&lang=it&output_product_xml=1';
    try {
        console.log('Fetching URL:', url);
        const res = await axios.get(url, { auth: { username: 'Wrdigital', password: 'Wrdigital12$' } });
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(res.data);
        const product = result['ICECAT-interface']?.Product;
        
        console.log('DEBUG: product keys:', Object.keys(product || {}));
        
        if (product?.Category) {
            console.log('DEBUG: Category Structure:', JSON.stringify(product.Category, null, 2));
            const catObj = product.Category;
            let category = '';
            
            if (catObj.Name?.$?.Value) {
                category = catObj.Name.$.Value;
                console.log('MATCH 1: category =', category);
            } else if (catObj.Name?._) {
                category = catObj.Name._;
                console.log('MATCH 2: category =', category);
            } else if (catObj.$?.Name) {
                category = catObj.$.Name;
                console.log('MATCH 3: category =', category);
            }
            
            if (!category && product.CategoryName) {
                category = typeof product.CategoryName === 'string' ? product.CategoryName : (product.CategoryName._ || product.CategoryName.$?.Value || '');
                console.log('MATCH FALLBACK: category =', category);
            }
            
            console.log('FINAL CATEGORY RESULT:', category);
        } else {
            console.log('DEBUG: No Category found in product');
        }
    } catch (e: any) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
}

check();
