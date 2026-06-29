"use client";

import { CheckCircle2 } from "lucide-react";

interface FeedbackModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function FeedbackModal({
  title,
  description,
  confirmLabel = "확인",
  onConfirm,
}: FeedbackModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-6 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative w-[460px] overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 p-8 text-center shadow-[0_28px_80px_rgba(80,60,160,0.24)]">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8c5bff_0%,#78a9ff_52%,#79e4dd_100%)]"
          aria-hidden="true"
        />
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f4f0ff_0%,#ecffff_100%)] text-[#8c5bff] shadow-lg shadow-violet-500/10">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </div>
        <h2
          id="feedback-modal-title"
          className="mt-6 text-3xl font-black tracking-normal text-zinc-950"
        >
          {title}
        </h2>
        <p className="mt-4 text-base font-semibold leading-7 text-zinc-600">
          {description}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-8 h-[52px] w-full cursor-pointer rounded-lg bg-[linear-gradient(135deg,#8c5bff_0%,#8973ff_42%,#78a9ff_74%,#79e4dd_100%)] text-base font-black text-white shadow-lg shadow-violet-400/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-400/25"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
