import axios from 'axios';

// Create an axios instance that will be used throughout the frontend
const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL as string) || '/api',
    timeout: 30000, // Aumentato a 30s per il cloud
});

// Interceptor to handle 429 Too Many Requests with exponential back‑off
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { config, response } = error;
        if (response?.status === 429 && !config.__retry) {
            config.__retry = true;
            // If the server sends a Retry‑After header, respect it; otherwise use exponential back‑off
            const retryAfter = parseInt(response.headers['retry-after'] || '0', 10);
            const delay = retryAfter > 0 ? retryAfter * 1000 : (config.__retryCount || 0) * 500 + 500;
            await new Promise((resolve) => setTimeout(resolve, delay));
            config.__retryCount = (config.__retryCount || 0) + 1;
            return api(config);
        }
        return Promise.reject(error);
    }
);

export default api;
