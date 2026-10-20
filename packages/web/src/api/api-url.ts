export const DEFAULT_API_BASE = '/api';

const ALLOWED_PREFIXES = ['http://', 'https://', '/'] as const;

export function resolveApiBase(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '') {
    return DEFAULT_API_BASE;
  }
  if (!ALLOWED_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    throw new Error(`VITE_API_URL musi zaczynać się od http://, https:// albo /, a ma wartość "${trimmed}".`);
  }
  return trimmed.replace(/\/+$/, '');
}

export function liveSocketUrl(apiBase: string, path: string, page: { readonly protocol: string; readonly host: string }): string {
  if (apiBase.startsWith('https://')) {
    return `wss://${apiBase.slice('https://'.length)}${path}`;
  }
  if (apiBase.startsWith('http://')) {
    return `ws://${apiBase.slice('http://'.length)}${path}`;
  }
  const protocol = page.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${page.host}${apiBase}${path}`;
}
