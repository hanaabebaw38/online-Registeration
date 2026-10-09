const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://online-registeration-backend.onrender.com').replace(/\/+$/, '');

export function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
