"use client";

import type { ReactNode } from "react";
import { useWorkspace } from "./workspace-provider";

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { hydrated, workspace, initializeBlank, initializeDemo } = useWorkspace();

  if (!hydrated) return <main className="grid min-h-screen place-items-center bg-slate-50"><p className="text-sm text-slate-500">Loading FAIR…</p></main>;
  if (workspace) return children;

  return <main className="grid min-h-screen place-items-center bg-[#f5f7fa] p-5">
    <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
      <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-base font-bold text-white">F</span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[.14em] text-blue-600">Welcome to FAIR</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Choose your competition workspace</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Your workspace stays in this browser and is not shared with other visitors.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={initializeDemo} className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-400">
          <span className="font-semibold text-blue-800">Try Demo Business</span>
          <span className="mt-2 block text-sm leading-5 text-slate-600">Explore a ready-to-use Franklin Barbecue Truth Hub preset.</span>
        </button>
        <button type="button" onClick={initializeBlank} className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-400 hover:bg-slate-50">
          <span className="font-semibold text-slate-900">Use My Business</span>
          <span className="mt-2 block text-sm leading-5 text-slate-600">Start with an empty generic business workspace.</span>
        </button>
      </div>
    </section>
  </main>;
}
