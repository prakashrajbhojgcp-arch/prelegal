// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AuthForm } from "@/components/auth-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe("AuthForm — sign in mode", () => {
  it("does not show the name field and POSTs to /api/auth/login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, email: "a@b.co", name: "Ada" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthForm />);

    expect(screen.queryByLabelText(/^name$/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "a@b.co",
      password: "hunter22-secret",
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders 'Invalid email or password.' on a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: "Invalid email or password." }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<AuthForm />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText(/invalid email or password/i),
    ).toBeDefined();
  });
});

describe("AuthForm — sign up mode", () => {
  it("toggles to sign-up: shows name field and POSTs to /api/auth/signup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, email: "a@b.co", name: "Ada" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthForm />);
    fireEvent.click(screen.getByRole("tab", { name: /sign up/i }));

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/signup");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "a@b.co",
      name: "Ada",
      password: "hunter22-secret",
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("flags too-short password client-side without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthForm />);
    fireEvent.click(screen.getByRole("tab", { name: /sign up/i }));

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/at least 8 characters/i),
    ).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the duplicate-email message on a 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: "An account already exists for that email.",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<AuthForm />);
    fireEvent.click(screen.getByRole("tab", { name: /sign up/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.co" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter22-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/account already exists/i),
    ).toBeDefined();
  });
});
