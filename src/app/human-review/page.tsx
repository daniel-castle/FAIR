import type { Metadata } from "next";
import { HumanReviewDashboard } from "@/components/human-review-dashboard";
import { PageHeader } from "@/components/page-header";
export const metadata: Metadata = { title: "Human Review" };
export default function HumanReviewPage() { return <><PageHeader title="Human Review" description="AI handles scale. Humans handle judgment. Adjudicate uncertain and conflicting benchmark evidence."/><HumanReviewDashboard/></>; }
