import Link from "next/link";
import { PageHeader } from "@/components/page-header";

const metrics = [
  { label: "Mention rate", value: "—", helper: "No monitoring runs yet" },
  { label: "Top recommendation rate", value: "—", helper: "No monitoring runs yet" },
  { label: "Factual accuracy", value: "—", helper: "Add verified facts first" },
];

const steps = [
  {
    number: "01",
    title: "Add verified facts",
    description: "Build a reliable source of truth for the demo business.",
    href: "/truth-hub",
    action: "Open Truth Hub",
  },
  {
    number: "02",
    title: "Prepare search queries",
    description: "Create realistic questions for different intents and audiences.",
    href: "/queries",
    action: "View Queries",
  },
  {
    number: "03",
    title: "Run monitoring",
    description: "Measure visibility and compare AI claims with verified facts.",
    href: "/monitoring",
    action: "View Monitoring",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Track how your business appears in AI-powered search and recommendations."
      />

      <section aria-labelledby="metrics-heading" className="mt-8">
        <h2 id="metrics-heading" className="sr-only">
          Key metrics
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-600">{metric.label}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                {metric.value}
              </p>
              <p className="mt-2 text-sm text-slate-500">{metric.helper}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="getting-started-heading"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            Competition prototype
          </p>
          <h2
            id="getting-started-heading"
            className="mt-2 text-xl font-semibold text-slate-900"
          >
            Start with the monitoring loop
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The foundation is ready. These steps show where verified business data,
            AI queries, and measured results will connect next.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="flex min-h-52 flex-col rounded-xl bg-slate-50 p-5"
            >
              <span className="text-sm font-semibold text-teal-700">{step.number}</span>
              <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              <Link
                href={step.href}
                className="mt-auto pt-5 text-sm font-semibold text-slate-900 transition-colors hover:text-teal-700"
              >
                {step.action} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
