"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

type ApiError = { detail?: string | { msg?: string }[] };

const MIN_PASSWORD_LEN = 8;

function extractError(payload: ApiError | null, fallback: string): string {
  if (!payload?.detail) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  return payload.detail[0]?.msg ?? fallback;
}

const inputCx = cn(
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2",
  "text-sm text-slate-900 placeholder:text-slate-400 shadow-sm",
  "focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue",
);

const pillCx = (active: boolean) =>
  cn(
    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
    active
      ? "bg-white text-brand-navy shadow-sm"
      : "text-brand-gray hover:text-brand-navy",
  );

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < MIN_PASSWORD_LEN) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const endpoint =
        mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "signin"
          ? { email, password }
          : { email, name, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiError | null;
        setError(
          extractError(
            payload,
            mode === "signin" ? "Sign-in failed." : "Sign-up failed.",
          ),
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="flex rounded-md bg-slate-100 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={pillCx(mode === "signin")}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={pillCx(mode === "signup")}
          onClick={() => switchMode("signup")}
        >
          Sign up
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4"
        aria-label={mode === "signin" ? "Sign in" : "Sign up"}
      >
        {mode === "signup" ? (
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-brand-navy"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(inputCx, "mt-1")}
              placeholder="Ada Lovelace"
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-brand-navy"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(inputCx, "mt-1")}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-brand-navy"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputCx, "mt-1")}
            placeholder={mode === "signup" ? "At least 8 characters" : ""}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-purple px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-purple/90 focus:outline-none focus:ring-2 focus:ring-brand-purple/40 disabled:opacity-60"
        >
          {submitting
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
