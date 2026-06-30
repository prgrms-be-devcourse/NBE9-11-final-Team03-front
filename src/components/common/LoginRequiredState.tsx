import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";

interface LoginRequiredStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  className?: string;
}

export function LoginRequiredState({
  title = "로그인이 필요합니다",
  description = "이 기능은 로그인 후 이용할 수 있어요.",
  actionLabel = "로그인 페이지로 이동",
  className = "",
}: LoginRequiredStateProps) {
  return (
    <div
      className={`rounded-lg border border-[#ded6ff] bg-[#fbf9ff] p-6 text-center shadow-sm shadow-violet-950/[0.04] ${className}`}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-[#8c5bff] ring-1 ring-[#ded6ff]">
        <LockKeyhole className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-lg font-black text-zinc-950">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-zinc-500">
        {description}
      </p>
      <Link
        href="/login"
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_48%,#79e4dd_100%)] px-5 text-sm font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25"
      >
        <span>{actionLabel}</span>
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
