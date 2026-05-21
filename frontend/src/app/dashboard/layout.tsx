import { redirect } from "next/navigation";

import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Dashboard · Prelegal",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex bg-slate-100 text-brand-navy">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={user} />
        <main className="flex-1 px-8 py-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
