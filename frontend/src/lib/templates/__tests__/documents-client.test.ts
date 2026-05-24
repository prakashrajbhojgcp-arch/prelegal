import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDocument,
  deleteDocument,
  DocumentsClientError,
  getDocument,
  listDocuments,
  updateDocument,
} from "@/lib/templates/documents-client";

afterEach(() => vi.restoreAllMocks());

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("documents-client", () => {
  it("listDocuments hits /api/documents and forwards the slug query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([]));
    vi.stubGlobal("fetch", fetchMock);
    await listDocuments();
    await listDocuments("mutual-nda");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/documents?slug=mutual-nda",
    );
  });

  it("createDocument POSTs and returns the new doc", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson(
        {
          id: 1,
          slug: "mutual-nda",
          title: "Acme ↔ Globex",
          fields: { purpose: "x" },
          updatedAt: "2026-05-24 00:00:00",
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const doc = await createDocument({
      slug: "mutual-nda",
      fields: { purpose: "x" },
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      slug: "mutual-nda",
      fields: { purpose: "x" },
    });
    expect(doc.id).toBe(1);
  });

  it("updateDocument PATCHes the resource", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({
        id: 1,
        slug: "mutual-nda",
        title: "x",
        fields: {},
        updatedAt: "2026-05-24 00:00:00",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await updateDocument(1, { fields: { purpose: "y" }, title: "x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/documents/1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      fields: { purpose: "y" },
      title: "x",
    });
  });

  it("getDocument GETs by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({
        id: 1,
        slug: "mutual-nda",
        title: "x",
        fields: {},
        updatedAt: "now",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await getDocument(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents/1");
  });

  it("deleteDocument DELETEs by id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteDocument(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
  });

  it("throws DocumentsClientError on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okJson({ detail: "Not found" }, 404)),
    );
    await expect(getDocument(99)).rejects.toBeInstanceOf(
      DocumentsClientError,
    );
  });
});
