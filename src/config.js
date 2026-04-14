const getHostBase = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3001`;
};

const normalizeBase = (value) => String(value || '').replace(/\/$/, '');

export const SERVER_BASE = normalizeBase(import.meta.env.VITE_SERVER_BASE) || getHostBase();
export const API_BASE = normalizeBase(import.meta.env.VITE_API_BASE) || `${SERVER_BASE}/api`;
export const SOCKET_BASE = normalizeBase(import.meta.env.VITE_SOCKET_BASE) || SERVER_BASE;
