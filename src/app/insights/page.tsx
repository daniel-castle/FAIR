import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <EmptyState
      eyebrow="Recommendations"
      title="Insights"
      description="Turn measured visibility and accuracy results into useful next actions."
      nextStep="AI-assisted recommendations will be reviewable, editable, approvable, or dismissible here."
    />
  );
}
