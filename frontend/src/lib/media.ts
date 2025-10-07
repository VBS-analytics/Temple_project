import api from './api';

const absoluteUrlPattern = /^https?:\/\//i;

export const resolveMediaUrl = (path?: string | null): string => {
  if (!path) {
    return '';
  }
  if (absoluteUrlPattern.test(path)) {
    return path;
  }
  const base = api.defaults.baseURL ?? '';
  if (!base) {
    return path;
  }
  const root = base.replace(/\/?api\/?$/, '/');
  const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedRoot}${normalizedPath}`;
};
