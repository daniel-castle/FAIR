import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { FairInsight, FilterBar } from "@/components/ui";
export const metadata: Metadata = { title: "Insights" };
const insights = [
  { observation: "Visibility among college-student queries is strong.", evidence: "88% mention rate across 17 benchmark queries, up 6 points this month.", action: "Preserve messaging around affordability and late-night availability." },
  { observation: "Budget-focused discovery is losing ground despite stable overall presence.", evidence: "Mention rate declined from 82% to 64% across 15 queries; two competitors gained position.", action: "Make current pricing and value options clearer across first-party sources." },
  { observation: "One outdated document is influencing multiple incorrect AI answers.", evidence: "old_menu.pdf appears in 4 conflicts involving hours and pricing.", action: "Remove or replace the document, then rerun the affected benchmark queries." },
  { observation: "Product-specific searches present an opportunity for improvement.", evidence: "58% visibility versus 74% overall visibility across 12 queries.", action: "Strengthen structured descriptions for high-value products and services." },
];
export default function InsightsPage() { return <><PageHeader title="Insights" description="Evidence-backed observations and recommended actions from FAIR."/><FilterBar filters={["All insight types", "All priorities", "Last 30 days"]}/><main className="bg-[#f8fafc] p-5 lg:p-7"><div className="grid gap-4 xl:grid-cols-2">{insights.map(item => <FairInsight key={item.observation} {...item}/>)}</div></main></>; }
