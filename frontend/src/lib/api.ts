import axios from 'axios';

import { useAuthStore } from '../store/auth';

const rawBaseUrl = typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__ ? __API_BASE_URL__ : 'http://localhost:8000/api';
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;

const api = axios.create({
  baseURL: normalizedBaseUrl,
});

api.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith('http')) {
    config.url = config.url.replace(/^\/+/, '');
  }
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.access) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  if (config.data && !(config.data instanceof FormData)) {
    config.headers = config.headers ?? {};
    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
  }
  return config;
});

export default api;

export const extractResults = <T>(payload: any): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (payload && Array.isArray(payload.results)) {
    return payload.results as T[];
  }
  return [];
};
