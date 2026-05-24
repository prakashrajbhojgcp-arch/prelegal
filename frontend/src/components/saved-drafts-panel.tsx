"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument,
  DocumentsClientError,
  listDocuments,
  type DocumentSummary,
} from "@/lib/templates/documents-client";

type Props = {
  slug: string;
  activeDocumentId: number | null;
  onResume: (documentId: number) => void;
  onDeleted: (documentId: number) => void;
};

type DeleteState =
  | { kind: "idle" }
  | { kind: "confirming"; id: number }
  | { kind: "deleting"; id: number };

const relative = (iso: string): string => {
  const now = Date.now();
  // Backend serializes SQLite datetime('now') as 'YYYY-MM-DD HH:MM:SS' in UTC.
  const then = new Date(iso.replace(" ", "T") + "Z").getTime();
  const diff = Math.max(0, now - then);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  return `${Math.floor(diff / day)} d ago`;
};

export function SavedDraftsPanel({
  slug,
  activeDocumentId,
  onResume,
  onDeleted,
}: Props) {
  const [drafts, setDrafts] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>({ kind: "idle" });

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await listDocuments(slug);
      setDrafts(list);
    } catch (err) {
      const detail =
        err instanceof DocumentsClientError
          ? err.detail
          : "Could not load saved drafts.";
      setError(detail);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConfirmDelete = useCallback(
    async (id: number) => {
      setDeleteState({ kind: "deleting", id });
      try {
        await deleteDocument(id);
        onDeleted(id);
        await refresh();
      } catch (err) {
        const detail =
          err instanceof DocumentsClientError
            ? err.detail
            : "Could not delete that draft.";
        setError(detail);
      } finally {
        setDeleteState({ kind: "idle" });
      }
    },
    [onDeleted, refresh],
  );

  return (
    <section
      aria-label="Saved drafts"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-navy">Saved drafts</h2>
        {drafts && drafts.length > 0 ? (
          <span className="text-xs text-brand-gray">
            {drafts.length} {drafts.length === 1 ? "draft" : "drafts"}
          </span>
        ) : null}
      </header>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {drafts === null ? (
          <p className="text-xs text-brand-gray">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="text-xs text-brand-gray">
            No saved drafts of this template yet.
          </p>
        ) : (
          drafts.map((draft) => {
            const isActive = draft.id === activeDocumentId;
            const isConfirming =
              deleteState.kind === "confirming" && deleteState.id === draft.id;
            const isDeleting =
              deleteState.kind === "deleting" && deleteState.id === draft.id;
            return (
              <div
                key={draft.id}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-navy">
                      {draft.title}
                      {isActive ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-blue">
                          editing
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-brand-gray">
                      Last saved {relative(draft.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onResume(draft.id)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-brand-navy hover:bg-slate-50"
                    >
                      Resume
                    </button>
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setDeleteState({ kind: "idle" })}
                          className="rounded-md px-2 py-1 text-xs text-brand-gray hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(draft.id)}
                          disabled={isDeleting}
                          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
                        >
                          Confirm
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteState({ kind: "confirming", id: draft.id })
                        }
                        className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
