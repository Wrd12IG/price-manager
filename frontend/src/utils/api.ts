import axios from 'axios';

const api = axios.create({
    // Usiamo path relativo /api per sfruttare il proxy di Vercel (vercel.json)
    // Questo risolve i problemi di routing tra frontend e backend
    baseURL: '/api',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Gestione errori e retry (utile per il "risveglio" di Render)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { config, response } = error;

        // Se il server sta dormendo (502/503/504) o troppe richieste (429)
        if ((response?.status === 429 || response?.status >= 502) && !config?.__retry) {
            config.__retry = true;
            console.log('Server in stand-by o occupato, riprovo tra 3 secondi...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return api(config);
        }
        return Promise.reject(error);
    }
);

export default api;
