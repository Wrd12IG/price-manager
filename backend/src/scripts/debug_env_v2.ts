import dotenv from 'dotenv';
dotenv.config();
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
if (process.env.JWT_SECRET) console.log('JWT_SECRET prefix:', process.env.JWT_SECRET.substring(0, 5));
console.log('DATABASE_URL prefix:', process.env.DATABASE_URL?.substring(0, 20));
