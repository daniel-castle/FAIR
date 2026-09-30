"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createBlankWorkspace, createDemoWorkspace } from "@/lib/workspace/presets";
import { isFairWorkspace, WORKSPACE_STORAGE_KEY, type FairWorkspace } from "@/lib/workspace/schema";

type WorkspaceContextValue = {
  hydrated: boolean;
  workspace: FairWorkspace | null;
  initializeBlank: () => void;
  initializeDemo: () => void;
  updateWorkspace: (update: (current: FairWorkspace) => FairWorkspace) => void;
  resetWorkspace: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [workspace, setWorkspace] = useState<FairWorkspace | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isFairWorkspace(parsed)) setWorkspace(parsed);
          else localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const save = useCallback((next: FairWorkspace) => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(next));
    setWorkspace(next);
  }, []);

  const initializeBlank = useCallback(() => save(createBlankWorkspace()), [save]);
  const initializeDemo = useCallback(() => save(createDemoWorkspace()), [save]);
  const updateWorkspace = useCallback((update: (current: FairWorkspace) => FairWorkspace) => {
    setWorkspace(current => {
      if (!current) return current;
      const next = { ...update(current), updatedAt: new Date().toISOString() };
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const resetWorkspace = useCallback(() => {
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    setWorkspace(null);
  }, []);

  const value = useMemo(() => ({ hydrated, workspace, initializeBlank, initializeDemo, updateWorkspace, resetWorkspace }), [hydrated, workspace, initializeBlank, initializeDemo, updateWorkspace, resetWorkspace]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider.");
  return context;
}
