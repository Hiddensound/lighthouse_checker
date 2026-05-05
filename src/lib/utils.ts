import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MAX_URLS_PER_AUDIT = 50;

/**
 * Parse URLs from text input (newline or comma separated)
 */
export function parseUrlsFromText(text: string): string[] {
  const raw = text
    .split(/[\n,]/)
    .map(url => url.trim())
    .filter(url => url.length > 0 && isValidUrl(url));
  return dedupeUrls(raw);
}

/**
 * Validate if a string is a valid http(s) URL
 */
export function isValidUrl(string: string): boolean {
  try {
    const u = new URL(string);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/**
 * Normalize a URL for dedupe — strip trailing slash on root path, lowercase host.
 */
export function normalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname === '/') u.pathname = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return input;
  }
}

/**
 * Deduplicate URLs after normalization, preserving order.
 */
export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = normalizeUrl(url);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(url);
    }
  }
  return out;
}

/**
 * Reject URLs whose hostname is loopback, link-local, or RFC1918 private.
 * Returns true if the URL is safe to fetch from a server context.
 */
export function isPublicHttpUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();
  if (!host) return false;

  // Block obvious unsafe hostnames
  const blockedHosts = ['localhost', 'ip6-localhost', 'ip6-loopback', 'broadcasthost'];
  if (blockedHosts.includes(host)) return false;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;

  // If host is a literal IP, range-check it.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 10) return false;                       // 10.0.0.0/8
    if (a === 127) return false;                      // 127.0.0.0/8
    if (a === 0) return false;                        // 0.0.0.0/8
    if (a === 169 && b === 254) return false;         // 169.254.0.0/16 (AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 192 && b === 168) return false;         // 192.168.0.0/16
    if (a >= 224) return false;                       // multicast / reserved
    return true;
  }

  // IPv6 literal — block loopback and unique-local / link-local
  if (host.startsWith('[') || host.includes(':')) {
    const v6 = host.replace(/^\[|\]$/g, '');
    if (v6 === '::1' || v6 === '::' ) return false;
    if (v6.startsWith('fc') || v6.startsWith('fd')) return false; // fc00::/7
    if (v6.startsWith('fe80')) return false;                       // link-local
    return true;
  }

  return true;
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate a timestamp string for file naming
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Create a URL slug from hostname
 */
export function createUrlSlug(url: string): string {
  try {
    return new URL(url).hostname.replace(/\./g, '-');
  } catch {
    return 'invalid-url';
  }
}