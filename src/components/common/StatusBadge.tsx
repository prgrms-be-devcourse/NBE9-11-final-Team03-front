import type { CreditTransactionType, ExchangeStatus } from "@/types/domain";
import { getCreditTransactionTypeLabel, getExchangeStatusLabel } from "@/utils/status";

type BadgeTone = "default" | "success" | "warning" | "danger" | "info";

interface StatusBadgeProps {
  label?: string;
  status?: ExchangeStatus;
  transactionType?: CreditTransactionType;
  tone?: BadgeTone;
}

function toneClass(tone: BadgeTone): string {
  const classes: Record<BadgeTone, string> = {
    default: "border-zinc-200 bg-zinc-100 text-zinc-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return classes[tone];
}

function statusTone(status?: ExchangeStatus): BadgeTone {
  if (status === "COMPLETED") return "success";
  if (status === "REJECTED" || status === "DISPUTED") return "danger";
  if (status === "SUBMITTED" || status === "REQUESTED") return "warning";
  if (status === "ACCEPTED" || status === "IN_PROGRESS") return "info";
  return "default";
}

export function StatusBadge({
  label,
  status,
  transactionType,
  tone,
}: StatusBadgeProps) {
  const display =
    label ??
    (status ? getExchangeStatusLabel(status) : undefined) ??
    (transactionType ? getCreditTransactionTypeLabel(transactionType) : "");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass(
        tone ?? statusTone(status),
      )}`}
    >
      {display}
    </span>
  );
}
