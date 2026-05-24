export type DocumentSummary = {
  id: number;
  slug: string;
  title: string;
  updatedAt: string;
};

export type DocumentDetail<Fields = unknown> = {
  id: number;
  slug: string;
  title: string;
  fields: Fields;
  updatedAt: string;
};

export class DocumentsClientError extends Error {
  readonly name = "DocumentsClientError";
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Documents request failed (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

async function parseError(response: Response): Promise<never> {
  let detail = response.statusText || "Request failed";
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    // statusText fallback
  }
  throw new DocumentsClientError(response.status, detail);
}

export async function listDocuments(
  slug?: string,
): Promise<DocumentSummary[]> {
  const url = slug
    ? `/api/documents?slug=${encodeURIComponent(slug)}`
    : "/api/documents";
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentSummary[];
}

export async function getDocument<Fields = unknown>(
  id: number,
): Promise<DocumentDetail<Fields>> {
  const response = await fetch(`/api/documents/${id}`, {
    credentials: "include",
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentDetail<Fields>;
}

export async function createDocument<Fields>(args: {
  slug: string;
  fields: Fields;
  title?: string;
}): Promise<DocumentDetail<Fields>> {
  const response = await fetch("/api/documents", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentDetail<Fields>;
}

export async function updateDocument<Fields>(
  id: number,
  args: { fields?: Fields; title?: string },
): Promise<DocumentDetail<Fields>> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) await parseError(response);
  return (await response.json()) as DocumentDetail<Fields>;
}

export async function deleteDocument(id: number): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) await parseError(response);
}
