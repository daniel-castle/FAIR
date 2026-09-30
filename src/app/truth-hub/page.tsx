import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TruthHub } from "@/components/truth-hub/truth-hub";
import { loadTruthHub } from "./actions";
export const metadata: Metadata = { title: "Truth Hub" };
export const dynamic = "force-dynamic";
export default async function TruthHubPage() {
  return <><PageHeader title="Truth Hub" description="Manage the trusted information AI systems should know about your business." /><TruthHub initial={await loadTruthHub()} /></>;
}
