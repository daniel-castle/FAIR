import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { QueryLibraryView } from "@/components/query-library";
export const metadata: Metadata = { title: "Queries" };
export default function QueriesPage() {
  return <><PageHeader title="Queries" description="Customer questions FAIR uses to benchmark how AI systems discover and represent this business." /><QueryLibraryView /></>;
}
