import type { PresenceHistoryPoint } from "@/lib/workspace/monitoring";

const series = [
  { key: "mentionRate" as const, label: "Mention rate", color: "#2563eb" },
  { key: "recommendationRate" as const, label: "Recommendation rate", color: "#16a34a" },
  { key: "factAccuracy" as const, label: "Fact accuracy", color: "#d97706" },
];

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export function PresenceChart({ points }: { points: PresenceHistoryPoint[] }) {
  if (!points.length) return <div className="p-8 text-center text-sm text-slate-500">Run a benchmark from Queries to begin real monitoring history.</div>;
  const x = (index: number) => points.length === 1 ? 350 : 20 + index / (points.length - 1) * 660;
  const y = (value: number) => 210 - value / 100 * 190;
  return <div className="px-5 pb-5 pt-4">
    <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">{series.map(item => <span key={item.key} className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }}/>{item.label}</span>)}</div>
    <div className="relative h-64"><div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-400">{[100, 75, 50, 25, 0].map(value => <div key={value} className="flex items-center gap-3"><span className="w-7 text-right">{value}%</span><span className="h-px flex-1 bg-slate-100"/></div>)}</div>
      <svg viewBox="0 0 700 230" preserveAspectRatio="none" className="absolute bottom-5 left-11 right-0 h-[210px] w-[calc(100%-44px)] overflow-visible" aria-label="AI presence over time">
        {series.map(item => {
          const values = points.flatMap((point, index) => point[item.key] === null ? [] : [{ index, value: point[item.key]!, date: point.date }]);
          return <g key={item.key}>{values.length > 1 && <polyline points={values.map(point => `${x(point.index)},${y(point.value)}`).join(" ")} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>}{values.map(point => <circle key={`${item.key}-${point.index}`} cx={x(point.index)} cy={y(point.value)} r="5" fill={item.color} stroke="white" strokeWidth="3"><title>{item.label}: {point.value.toFixed(1)}% · {shortDate(point.date)}</title></circle>)}</g>;
        })}
      </svg>
    </div>
    <div className="ml-11 flex justify-between text-[10px] text-slate-400">{points.map(point => <span key={point.runId}>{shortDate(point.date)}</span>)}</div>
    {points.length === 1 && <p className="mt-3 text-xs text-slate-500">One completed run so far. Future real runs will extend this history.</p>}
  </div>;
}
