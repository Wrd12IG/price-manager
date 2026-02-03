import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Flag per evitare loop infinito di refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Interceptor per aggiungere il token JWT
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor per gestire token scaduto e refresh automatico
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Se 401 e non è già un retry del refresh
        if (error.response?.status === 401) {
            if (!originalRequest._retry) {
                // Se è già in corso un refresh, accoda la richiesta
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                const refreshToken = localStorage.getItem('refreshToken');

                if (!refreshToken) {
                    // Nessun refresh token, redirect a login
                    handleLogout();
                    return Promise.reject(error);
                }

                try {
                    const response = await axios.post(
                        '/api/auth/refresh',
                        { refreshToken }
                    );

                    const { accessToken, user } = response.data;

                    // Salva nuovo token
                    localStorage.setItem('token', accessToken);
                    if (user) {
                        localStorage.setItem('user', JSON.stringify(user));
                    }

                    // Aggiorna header e riprocessa coda
                    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
                    processQueue(null, accessToken);

                    // Riprova richiesta originale
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    handleLogout();
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                // Se è già un _retry e siamo ancora 401, forza logout
                handleLogout();
            }
        }

        // Retry automatico per errori temporanei (429, 502, 503, 504)
        if ((error.response?.status === 429 || error.response?.status >= 502) && !originalRequest.__retry) {
            originalRequest.__retry = true;
            console.log('Errore temporaneo, riprovo tra 2 secondi...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return api(originalRequest);
        }

        return Promise.reject(error);
    }
);

// Funzione per gestire logout
const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    // Redirect a login solo se non siamo già lì
    if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
    }
};

export default api;
