export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-brand-navy text-white">
      <div className="px-6 py-6 border-b border-white/10">
        <span className="text-lg font-semibold tracking-tight">Prelegal</span>
      </div>
      <nav className="px-3 py-4 space-y-1 text-sm">
        <a
          href="/dashboard"
          className="block rounded-md px-3 py-2 bg-white/10 text-white"
          aria-current="page"
        >
          Templates
        </a>
        <span className="block rounded-md px-3 py-2 text-white/50 cursor-not-allowed">
          Documents
          <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-yellow">
            Soon
          </span>
        </span>
        <span className="block rounded-md px-3 py-2 text-white/50 cursor-not-allowed">
          Settings
          <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-yellow">
            Soon
          </span>
        </span>
      </nav>
    </aside>
  );
}
