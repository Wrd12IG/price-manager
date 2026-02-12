const bcrypt = require('bcryptjs');

async function verify() {
    const password = 'admin123';
    const hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIVInCBVVC';

    console.log('🔍 Comparing password "admin123" with hash...');
    const match = await bcrypt.compare(password, hash);
    console.log('✅ Match:', match);

    const newHash = await bcrypt.hash(password, 12);
    console.log('📝 New hash for "admin123":', newHash);
}

verify();
