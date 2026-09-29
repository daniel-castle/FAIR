import type { ReactNode } from "react";
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="flex flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center lg:px-7"><div><h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950">{title}</h1>{description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}</div>{action && <div className="shrink-0">{action}</div>}</header>;
}
