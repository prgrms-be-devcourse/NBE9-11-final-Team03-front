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
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="w-[420px] rounded-xl border border-zinc-200 bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2
          id="feedback-modal-title"
          className="mt-5 text-2xl font-black text-zinc-950"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-6 h-11 w-full rounded-md bg-zinc-950 text-sm font-bold text-white transition hover:bg-zinc-700"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
