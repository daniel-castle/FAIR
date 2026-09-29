import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Queries" };

export default function QueriesPage() {
  return (
    <EmptyState
      eyebrow="Search scenarios"
      title="Queries"
      description="Organize realistic questions by customer intent, audience, and category."
      nextStep="Generated and human-written query sets will live here once AI integration is added."
    />
  );
}
