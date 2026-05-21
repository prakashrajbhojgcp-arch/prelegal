"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ApiError = { detail?: string | { msg?: string }[] };

function extractError(payload: ApiError | null): string {
  if (!payload?.detail) return "Sign-in failed. Try again.";
  if (typeof payload.detail === "string") return payload.detail;
  return payload.detail[0]?.msg ?? "Sign-in failed. Try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ApiError | null;
        setError(extractError(payload));
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
    <form onSubmit={onSubmit} className="space-y-5" aria-label="Sign in">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-brand-navy">
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
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-brand-navy">
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
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          placeholder="Your name"
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
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
