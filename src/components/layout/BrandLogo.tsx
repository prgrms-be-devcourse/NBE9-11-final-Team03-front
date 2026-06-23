import { Handshake } from "lucide-react";

type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Baton">
      <span
        className={`relative inline-flex shrink-0 items-center justify-center rounded-md bg-zinc-950 shadow-sm ${
          compact ? "h-8 w-8" : "h-9 w-9"
        }`}
        aria-hidden="true"
      >
        <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-400" />
        <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400" />
        <Handshake
          className={compact ? "h-5 w-5 text-white" : "h-5.5 w-5.5 text-white"}
          strokeWidth={2.5}
        />
      </span>
      <span
        className={`font-black tracking-normal text-zinc-950 ${
          compact ? "text-base" : "text-xl"
        }`}
      >
        Baton
      </span>
    </span>
  );
}
