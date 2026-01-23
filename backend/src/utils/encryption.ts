import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Cripta una stringa usando AES
 */
export const encrypt = (text: string): string => {
    if (!text) return '';
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
};

/**
 * Decripta una stringa criptata con AES
 */
export const decrypt = (encryptedText: string): string => {
    if (!encryptedText || encryptedText === '***') return '';
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted;
    } catch (e) {
        console.error('Decryption failed, returning plain text/empty');
        return '';
    }
};

/**
 * Verifica se la chiave di encryption è configurata correttamente
 */
export const isEncryptionConfigured = (): boolean => {
    return ENCRYPTION_KEY !== 'default-key-change-in-production' && ENCRYPTION_KEY.length >= 32;
};
