import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
