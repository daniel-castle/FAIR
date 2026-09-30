"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const groups = [
  { label: "Overview", items: [{ label: "Overview", href: "/", icon: "grid" as IconName }] },
  { label: "Truth", items: [{ label: "Truth Hub", href: "/truth-hub", icon: "database" as IconName }] },
  { label: "Measure", items: [{ label: "Queries", href: "/queries", icon: "search" as IconName }, { label: "Metrics", href: "/metrics", icon: "pulse" as IconName }] },
  { label: "Improve", items: [{ label: "Issues", href: "/issues", icon: "alert" as IconName }, { label: "Insights", href: "/insights", icon: "spark" as IconName }, { label: "Human Review", href: "/human-review", icon: "review" as IconName }] },
];

export function Navigation() {
  const pathname = usePathname();
  return <nav aria-label="Primary" className="fair-scrollbar flex-1 overflow-x-auto px-3 pb-3 lg:overflow-y-auto lg:py-4">{groups.map(group => <div key={group.label} className="inline-block align-top lg:mb-5 lg:block"><p className="hidden px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400 lg:block">{group.label}</p><ul className="flex lg:block">{group.items.map(item => { const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <li key={item.href}><Link href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-w-max items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:mb-0.5 ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>{active && <span className="absolute -left-3 h-5 w-0.5 rounded-r bg-blue-600 lg:block"/>}<Icon name={item.icon} className="size-[18px]"/>{item.label}</Link></li>; })}</ul></div>)}</nav>;
}
