import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Icon } from "@/components/icons";
import { SectionCard } from "@/components/ui";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return <><PageHeader title="Insights" description="Evidence-backed observations and recommended actions from FAIR."/><main className="border-t border-slate-200 bg-[#f8fafc] p-5 lg:p-7"><SectionCard><div className="p-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon name="spark"/></span><h2 className="mt-4 text-base font-semibold text-slate-950">Insights will follow verified monitoring evidence</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">FAIR is not generating observations yet. First run controlled scans and calculate deterministic metrics; a later phase can use that computed evidence to explain patterns.</p><Link href="/metrics" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Open Metrics <Icon name="arrow"/></Link></div></SectionCard></main></>;
}
