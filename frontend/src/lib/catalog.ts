import "server-only";

import { serverApiUrl, type Catalog } from "@/lib/api";

export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch(serverApiUrl("/api/templates"), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load catalog (status ${response.status})`);
  }
  return (await response.json()) as Catalog;
}
