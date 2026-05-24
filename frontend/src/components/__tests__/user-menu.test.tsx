// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { UserMenu } from "@/components/user-menu";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe("UserMenu", () => {
  const user = { id: 1, email: "ada@example.com", name: "Ada Lovelace" };

  it("shows the avatar initial and opens the dropdown on click", () => {
    render(<UserMenu user={user} />);
    const trigger = screen.getByLabelText(/account menu/i);
    expect(trigger.textContent).toContain("A");
    fireEvent.click(trigger);
    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByText("ada@example.com")).toBeDefined();
  });

  it("POSTs to /api/auth/logout and routes to /login on Sign out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<UserMenu user={user} />);
    fireEvent.click(screen.getByLabelText(/account menu/i));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
