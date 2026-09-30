import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { MonitoringDashboard } from "@/components/monitoring-dashboard";
import { loadMonitoringDashboard } from "@/lib/monitoring/data";

export const metadata: Metadata = { title: "Metrics" };
export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  return <><PageHeader title="Metrics" description="Measure how this business performs across FAIR's controlled AI benchmark."/><MonitoringDashboard data={await loadMonitoringDashboard()}/></>;
}
