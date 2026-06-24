interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionTitle({ eyebrow, title, description }: SectionTitleProps) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-2 text-sm font-semibold text-teal-700">{eyebrow}</p>
      ) : null}
      <h2 className="text-3xl font-bold tracking-normal text-zinc-950">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-base leading-6 text-zinc-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}
