// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SavedDraftsPanel } from "@/components/saved-drafts-panel";
import * as documentsClient from "@/lib/templates/documents-client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SavedDraftsPanel", () => {
  it("renders the empty state when there are no drafts", async () => {
    vi.spyOn(documentsClient, "listDocuments").mockResolvedValue([]);
    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(documentsClient.listDocuments).toHaveBeenCalled(),
    );
    expect(
      await screen.findByText(/no saved drafts of this template yet/i),
    ).toBeDefined();
  });

  it("lists saved drafts and invokes onResume when Resume is clicked", async () => {
    vi.spyOn(documentsClient, "listDocuments").mockResolvedValue([
      {
        id: 5,
        slug: "mutual-nda",
        title: "Acme ↔ Globex",
        updatedAt: "2026-05-24 00:00:00",
      },
    ]);
    const onResume = vi.fn();
    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={onResume}
        onDeleted={vi.fn()}
      />,
    );
    expect(await screen.findByText("Acme ↔ Globex")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(onResume).toHaveBeenCalledWith(5);
  });

  it("deletes a draft after the user confirms", async () => {
    const listSpy = vi
      .spyOn(documentsClient, "listDocuments")
      .mockResolvedValueOnce([
        {
          id: 7,
          slug: "mutual-nda",
          title: "Draft 1",
          updatedAt: "2026-05-24 00:00:00",
        },
      ])
      .mockResolvedValueOnce([]);
    const deleteSpy = vi
      .spyOn(documentsClient, "deleteDocument")
      .mockResolvedValue();
    const onDeleted = vi.fn();

    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={vi.fn()}
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(7));
    expect(onDeleted).toHaveBeenCalledWith(7);
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it("surfaces an alert when the list call fails", async () => {
    vi.spyOn(documentsClient, "listDocuments").mockRejectedValue(
      new documentsClient.DocumentsClientError(500, "boom"),
    );
    render(
      <SavedDraftsPanel
        slug="mutual-nda"
        activeDocumentId={null}
        onResume={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toBeDefined();
  });
});
