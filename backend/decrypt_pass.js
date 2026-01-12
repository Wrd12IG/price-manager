
const CryptoJS = require('crypto-js');
const encrypted = 'U2FsdGVkX1/qZ7d2dViFCdFulzNW4Myo2A71DoKgBsM=';
const key = '32-char-secret-key-for-aes-256';
const bytes = CryptoJS.AES.decrypt(encrypted, key);
const decrypted = bytes.toString(CryptoJS.enc.Utf8);
console.log('DECRYPTED_PASSWORD:', decrypted);
