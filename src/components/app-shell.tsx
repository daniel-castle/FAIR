import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-200 bg-slate-950 text-white lg:fixed lg:inset-y-0 lg:w-[248px] lg:border-b-0 lg:border-r lg:border-slate-800">
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center justify-between px-5 lg:justify-start">
            <Link href="/" className="flex items-center gap-3" aria-label="FAIR dashboard">
              <span className="grid size-9 place-items-center rounded-xl bg-teal-400 font-bold text-slate-950">
                F
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-wide">FAIR</span>
                <span className="block text-xs text-slate-400">AI visibility</span>
              </span>
            </Link>
            <span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1 text-xs font-medium text-teal-200 lg:hidden">
              Demo Business
            </span>
          </div>

          <Navigation />

          <div className="mt-auto hidden border-t border-slate-800 p-5 lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Workspace
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-teal-300/10 text-sm font-semibold text-teal-200">
                DB
              </span>
              <div>
                <p className="text-sm font-medium text-white">Demo Business</p>
                <p className="text-xs text-slate-400">Prototype workspace</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:col-start-2">
        <header className="hidden h-20 items-center justify-end border-b border-slate-200 bg-white px-8 lg:flex">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
            Demo Business
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
