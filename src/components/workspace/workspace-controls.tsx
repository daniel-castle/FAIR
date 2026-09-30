"use client";

import { useWorkspace } from "./workspace-provider";

export function WorkspaceControls() {
  const { workspace, resetWorkspace } = useWorkspace();
  if (!workspace) return null;
  const name = String(workspace.truthHub.business.name || "My Business");
  return <div className="border-t border-slate-100 p-3">
    <div className="rounded-lg p-2">
      <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
      <p className="text-[11px] text-slate-400">Browser workspace</p>
      <button type="button" onClick={() => { if (window.confirm("Clear this browser's FAIR workspace and start over?")) resetWorkspace(); }} className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700">Start Over</button>
    </div>
  </div>;
}
