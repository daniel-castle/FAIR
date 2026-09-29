import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation";
import { Icon } from "@/components/icons";

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
    <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:z-20 lg:flex lg:w-[232px] lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="FAIR overview"><span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">F</span><span><span className="block text-[15px] font-bold tracking-tight text-slate-950">FAIR</span><span className="block text-[10px] text-slate-400">AI truth intelligence</span></span></Link>
        <button type="button" aria-label="Business switcher" className="text-slate-400"><span className="text-base">⌃</span></button>
      </div>
      <Navigation/>
      <div className="hidden border-t border-slate-100 p-3 lg:block"><div className="flex items-center gap-3 rounded-lg p-2"><span className="grid size-8 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">DB</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">Demo Business</p><p className="text-[11px] text-slate-400">Competition workspace</p></div><Icon name="more" className="size-4 text-slate-400"/></div></div>
    </aside>
    <div className="min-w-0 lg:col-start-2"><div className="min-h-screen bg-[#f5f7fa] p-0 lg:p-3"><div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1500px] overflow-hidden bg-white lg:rounded-2xl lg:border lg:border-slate-200"><div className="border-b border-slate-200 bg-white px-5 py-2.5 text-right lg:px-7"><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"><span className="size-1.5 rounded-full bg-green-500"/>Demo Business</span></div>{children}</div></div></div>
  </div>;
}
