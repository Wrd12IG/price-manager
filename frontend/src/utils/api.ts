import axios from 'axios';

const api = axios.create({
    // Puntiamo direttamente a Render per evitare conflitti con Vercel
    baseURL: 'https://price-manager-5ait.onrender.com/api',
    timeout: 30000,
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
        if ((response?.status === 429 || response?.status >= 502) && !config.__retry) {
            config.__retry = true;
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return api(config);
        }
        return Promise.reject(error);
    }
);

export default api;
