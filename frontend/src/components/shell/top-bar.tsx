import { LogoutButton } from "@/components/logout-button";
import type { User } from "@/lib/api";

export function TopBar({ user }: { user: User }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
      <div className="flex items-center gap-3">
        <span className="md:hidden font-semibold text-brand-navy">Prelegal</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-brand-navy" data-testid="user-name">
            {user.name}
          </p>
          <p className="text-xs text-brand-gray">{user.email}</p>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
