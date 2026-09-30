import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { QueryLibraryView } from "@/components/query-library";
import { loadQueryLibrary } from "./actions";
export const metadata: Metadata = { title: "Queries" };
export const dynamic = "force-dynamic";
export default async function QueriesPage() {
  return <><PageHeader title="Queries" description="Benchmark prompts that measure how customers discover this business." /><QueryLibraryView library={await loadQueryLibrary()} /></>;
}
