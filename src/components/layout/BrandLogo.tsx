type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogoContent() {
  return (
    <>
      <span className="brandGlyph" aria-hidden="true">
        <i />
        <i />
      </span>
      <strong className="brandLogoText">Baton</strong>
    </>
  );
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-2.5" aria-label="Baton">
        <span
          className={`inline-flex shrink-0 items-end gap-1 ${
            compact ? "h-7 w-7" : "h-8 w-8"
          }`}
          aria-hidden="true"
        >
          <span
            className={`w-1.5 rounded-full bg-[linear-gradient(180deg,#8c5bff_0%,#6d7cff_100%)] ${
              compact ? "h-5" : "h-6"
            }`}
          />
          <span
            className={`w-1.5 rounded-full bg-[linear-gradient(180deg,#8c5bff_0%,#6d7cff_100%)] ${
              compact ? "h-7" : "h-8"
            }`}
          />
          <span
            className={`mb-1.5 w-1.5 rounded-full bg-[linear-gradient(180deg,#8c5bff_0%,#6d7cff_100%)] ${
              compact ? "h-4" : "h-5"
            }`}
          />
        </span>
        <span
          className={`font-black leading-none tracking-normal text-zinc-950 ${
            compact ? "text-[22px]" : "text-[26px]"
          }`}
        >
          Baton
        </span>
      </span>
    );
  }

  return (
    <span className="brandLogoContent" aria-label="Baton">
      <BrandLogoContent />
    </span>
  );
}
