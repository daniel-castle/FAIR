import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Truth Hub" };

export default function TruthHubPage() {
  return (
    <EmptyState
      eyebrow="Source of truth"
      title="Truth Hub"
      description="Manage verified facts about the business, its offerings, and its policies."
      nextStep="This is where a flexible, generic business fact model will be connected to Supabase."
    />
  );
}
