/**
 * Backend HTTP helpers.
 *
 * Browser code uses relative URLs and Next.js rewrites proxy to the backend
 * (configured in next.config.ts). Server code can't rely on rewrites, so it
 * uses BACKEND_URL from the environment directly.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const SESSION_COOKIE = "prelegal_session";

export const sessionCookieName = SESSION_COOKIE;

export function serverApiUrl(path: string): string {
  return `${BACKEND_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export type CatalogTemplate = {
  name: string;
  description: string;
  filename: string;
  source?: string;
};

export type Catalog = {
  source: string;
  license: string;
  license_url: string;
  templates_dir: string;
  templates: CatalogTemplate[];
};

export type User = {
  id: number;
  email: string;
  name: string;
};
