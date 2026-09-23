import axios from 'axios';

// Fall back to a same-origin "/api" when no VITE_API_URL is provided.
//
// The .env files are gitignored, so a fresh clone (CI, a new machine, the
// production server) has none: without this fallback the bundle would be
// built with `baseURL: undefined` and every request would hit the static
// host instead of the API. In production the SPA and the API share one
// domain, so a relative URL is correct there.
const API_URL = import.meta.env.VITE_API_URL || '/api';

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

let isRedirecting = false;

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        const isAuthExpired =
            error.response?.status === 401 && error.config?.skipAuthLogout !== true;

        if (isAuthExpired && !isRedirecting) {
            isRedirecting = true;
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/auth/login';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
