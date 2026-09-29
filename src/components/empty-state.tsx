import { PageHeader } from "@/components/page-header";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  nextStep: string;
};

export function EmptyState({ eyebrow, title, description, nextStep }: EmptyStateProps) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-teal-50 text-xl text-teal-700">
          +
        </div>
        <h2 className="mt-5 text-lg font-semibold text-slate-900">Ready for the next step</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{nextStep}</p>
        <span className="mt-6 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Foundation placeholder
        </span>
      </section>
    </div>
  );
}
