import { MasterFileService } from './src/services/MasterFileService';

async function test() {
    console.log('🧪 Testing getMasterFile...');
    try {
        const result = await MasterFileService.getMasterFile(1, 25, '');
        console.log('✅ Success! Found products:', result.data.length);
    } catch (error) {
        console.error('❌ Error in getMasterFile:', error);
    }
    process.exit(0);
}

test();
