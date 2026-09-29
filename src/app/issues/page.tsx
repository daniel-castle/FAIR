import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Issues" };

export default function IssuesPage() {
  return (
    <EmptyState
      eyebrow="Accuracy review"
      title="Issues"
      description="Review mismatches, outdated claims, and possible AI hallucinations."
      nextStep="Detected claims will be compared with verified facts and queued for human review here."
    />
  );
}
