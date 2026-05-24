"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/api";

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  return parts[0][0].toUpperCase();
};

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          "bg-brand-purple text-white text-sm font-semibold",
          "focus:outline-none focus:ring-2 focus:ring-brand-purple/40",
        )}
      >
        {initials(user.name)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-md border border-slate-200 bg-white p-3 shadow-md"
        >
          <p
            className="text-sm font-medium text-brand-navy"
            data-testid="user-name"
          >
            {user.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-brand-gray">
            {user.email}
          </p>
          <hr className="my-2 border-slate-200" />
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-brand-navy hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
