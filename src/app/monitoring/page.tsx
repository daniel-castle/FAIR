import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Monitoring" };

export default function MonitoringPage() {
  return (
    <EmptyState
      eyebrow="AI visibility"
      title="Monitoring"
      description="Run AI search checks and track when, where, and how the business appears."
      nextStep="Future monitoring runs will collect responses, positions, and extracted claims here."
    />
  );
}
