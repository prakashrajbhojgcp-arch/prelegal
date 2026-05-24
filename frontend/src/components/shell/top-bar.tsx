import { UserMenu } from "@/components/user-menu";
import type { User } from "@/lib/api";

export function TopBar({ user }: { user: User }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-brand-navy">Prelegal</span>
      </div>
      <UserMenu user={user} />
    </header>
  );
}
