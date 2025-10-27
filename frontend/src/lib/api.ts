import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '../store/auth';

const defaultBaseUrl = 'http://localhost:8000/api';
const rawBaseUrl =
  typeof __API_BASE_URL__ === 'string' && __API_BASE_URL__ ? __API_BASE_URL__ : defaultBaseUrl;

const LOCAL_ONLY_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', 'backend']);

const resolveBaseUrl = (value: string): string => {
  if (typeof window === 'undefined') {
    return value;
  }

  try {
    const url = new URL(value, window.location.origin);
    if (LOCAL_ONLY_HOSTS.has(url.hostname) && window.location.hostname) {
      url.hostname = window.location.hostname;
    }
    return url.toString();
  } catch {
    return value;
  }
};

const baseUrl = resolveBaseUrl(rawBaseUrl);
const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

const api = axios.create({
  baseURL: normalizedBaseUrl,
});

const ensureHeaders = (config: InternalAxiosRequestConfig): AxiosHeaders => {
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  } else if (!(config.headers instanceof AxiosHeaders)) {
    config.headers = new AxiosHeaders(config.headers);
  }
  return config.headers as AxiosHeaders;
};

api.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith('http')) {
    config.url = config.url.replace(/^\/+/, '');
  }
  const headers = ensureHeaders(config);
  const tokens = useAuthStore.getState().tokens;
  if (tokens?.access) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
  }
  if (config.data && !(config.data instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
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
