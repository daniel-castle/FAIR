import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TruthHub } from "@/components/truth-hub/truth-hub";
export const metadata: Metadata = { title: "Truth Hub" };
export default function TruthHubPage() {
  return <><PageHeader title="Truth Hub" description="Manage the trusted information AI systems should know about your business." /><TruthHub /></>;
}
