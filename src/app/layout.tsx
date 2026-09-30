import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { WorkspaceGate } from "@/components/workspace/workspace-gate";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FAIR | AI visibility for small businesses",
    template: "%s | FAIR",
  },
  description: "Monitor and improve how a business appears in AI-powered search.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-950">
        <WorkspaceProvider>
          <WorkspaceGate><AppShell>{children}</AppShell></WorkspaceGate>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
