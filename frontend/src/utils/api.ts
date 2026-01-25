import axios from 'axios';

const api = axios.create({
    // Backend su VPS Aruba (Italia) - Sempre attivo e sicuro tramite HTTPS
    baseURL: 'https://pricemanager.wrdigital.it/api',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Gestione errori
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { config, response } = error;

        // Retry automatico per errori temporanei (429, 502, 503, 504)
        if ((response?.status === 429 || response?.status >= 502) && !config?.__retry) {
            config.__retry = true;
            console.log('Errore temporaneo, riprovo tra 2 secondi...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return api(config);
        }
        return Promise.reject(error);
    }
);

export default api;
