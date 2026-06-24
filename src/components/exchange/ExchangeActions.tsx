"use client";

import Link from "next/link";
import type { ExchangeStatus } from "@/types/domain";

interface ExchangeActionsProps {
  exchangeId: number;
  status: ExchangeStatus;
}

export function ExchangeActions({ exchangeId, status }: ExchangeActionsProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-700">
        exchanges 상태 변경 API가 없어 이 화면에서는 거래 액션을 처리하지
        않습니다.
      </p>
      <p className="mt-2 text-xs text-zinc-500">현재 상태: {status}</p>
      <Link
        href={`/trades/${exchangeId}`}
        className="mt-4 inline-flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-bold text-white transition hover:bg-zinc-700"
      >
        실제 거래 상세로 이동
      </Link>
    </div>
  );
}
