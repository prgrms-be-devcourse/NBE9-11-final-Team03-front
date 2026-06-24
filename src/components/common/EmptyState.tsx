import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
      <p className="text-base font-semibold text-zinc-900">{title}</p>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
