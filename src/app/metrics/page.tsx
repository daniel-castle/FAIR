import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { MonitoringDashboard } from "@/components/monitoring-dashboard";

export const metadata: Metadata = { title: "Metrics" };

export default function MetricsPage() {
  return <><PageHeader title="Metrics" description="Measure how this business performs across FAIR's controlled AI benchmark."/><MonitoringDashboard /></>;
}
