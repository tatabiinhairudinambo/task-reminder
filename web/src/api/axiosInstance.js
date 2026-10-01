'use client';

import axios from 'axios';

// Same-origin API. In the Laravel build the SPA called a separate host via
// VITE_API_URL; here Next serves both the UI and the API routes, so a relative
// "/api" is always correct.
//
// Auth is an httpOnly cookie set by the API, so there is no Authorization
// header and nothing sensitive in localStorage.
const axiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // Send the session cookie on every request.
  withCredentials: true,
});

let isRedirecting = false;

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
