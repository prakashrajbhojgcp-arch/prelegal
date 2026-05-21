import "server-only";

import { cookies } from "next/headers";

import { sessionCookieName, serverApiUrl, type User } from "@/lib/api";

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;
  const response = await fetch(serverApiUrl("/api/auth/me"), {
    headers: { cookie: `${sessionCookieName}=${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as User;
}
