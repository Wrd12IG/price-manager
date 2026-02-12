
import dotenv from 'dotenv';
dotenv.config();

console.log('Current Directory:', process.cwd());
console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'UNDEFINED');
console.log('DIRECT_URL:', process.env.DIRECT_URL ? process.env.DIRECT_URL.substring(0, 20) + '...' : 'UNDEFINED');
