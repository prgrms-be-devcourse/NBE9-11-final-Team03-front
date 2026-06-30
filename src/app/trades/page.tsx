"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { tradeApi, type TradeListRes, type TradeStatus } from "@/lib/api";
import { getStoredUserId, hasStoredAccessToken } from "@/lib/auth";
import { formatCredit, formatDate } from "@/utils/format";

const PAGE_SIZE = 20;

type TradeListItem = TradeListRes & {
  tradeGroupId?: number | null;
  talentTitle?: string | null;
};

interface TradeGroupView {
  groupKey: string;
  tradeType: TradeListItem["tradeType"];
  trades: TradeListItem[];
  updatedAt: string;
}

const statusOptions: { value: TradeStatus | ""; label: string }[] = [
  { value: "", label: "전체" },
  { value: "IN_PROGRESS", label: "진행 중" },
  { value: "UNDER_REVIEW", label: "검토 중" },
  { value: "AWAITING_PARTNER", label: "상대 확정 대기" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
  { value: "DISPUTED", label: "분쟁" },
];

const statusLabels: Record<TradeStatus, string> = {
  IN_PROGRESS: "진행 중",
  UNDER_REVIEW: "검토 중",
  AWAITING_PARTNER: "상대 확정 대기",
  COMPLETED: "완료",
  CANCELLED: "취소",
  DISPUTED: "분쟁",
};

function getStatusTone(
  status: TradeStatus,
): "default" | "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED" || status === "DISPUTED") return "danger";
  if (status === "UNDER_REVIEW" || status === "AWAITING_PARTNER") {
    return "warning";
  }
  if (status === "IN_PROGRESS") return "info";
  return "default";
}

function getStatusPillClass(status: TradeStatus): string {
  const tone = getStatusTone(status);

  const classes = {
    default: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-600",
    info: "border-[#d9ccff] bg-[#f4f0ff] text-[#8c5bff]",
  };

  return classes[tone];
}

function TradeStatusPill({ status }: { status: TradeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-black ${getStatusPillClass(
        status,
      )}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function TradeTypePill({
  tradeType,
}: {
  tradeType: TradeListItem["tradeType"];
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#d9ccff] bg-white px-3 py-1.5 text-xs font-black text-[#8c5bff]">
      {tradeType === "SWAP" ? "재능 교환" : "크레딧 구매"}
    </span>
  );
}

function groupTradesForView(trades: TradeListItem[]): TradeGroupView[] {
  const map = new Map<string, TradeGroupView>();

  for (const trade of trades) {
    const groupKey =
      trade.tradeType === "SWAP" && trade.tradeGroupId != null
        ? `swap-${trade.tradeGroupId}`
        : `trade-${trade.tradeId}`;

    const current = map.get(groupKey);

    if (!current) {
      map.set(groupKey, {
        groupKey,
        tradeType: trade.tradeType,
        trades: [trade],
        updatedAt: trade.updatedAt,
      });
      continue;
    }

    current.trades.push(trade);

    if (
      new Date(trade.updatedAt).getTime() >
      new Date(current.updatedAt).getTime()
    ) {
      current.updatedAt = trade.updatedAt;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function getRepresentativeStatus(group: TradeGroupView): TradeStatus {
  const priority: TradeStatus[] = [
    "DISPUTED",
    "UNDER_REVIEW",
    "AWAITING_PARTNER",
    "IN_PROGRESS",
    "CANCELLED",
    "COMPLETED",
  ];

  return (
    priority.find((status) =>
      group.trades.some((trade) => trade.tradeStatus === status),
    ) ?? group.trades[0].tradeStatus
  );
}

function formatGroupCredit(group: TradeGroupView) {
  if (group.tradeType !== "SWAP" || group.trades.length < 2) {
    return formatCredit(group.trades[0].creditPrice);
  }

  const firstCreditPrice = group.trades[0].creditPrice;
  const isSameCreditPrice = group.trades.every(
    (trade) => trade.creditPrice === firstCreditPrice,
  );

  if (isSameCreditPrice) {
    return `각 ${formatCredit(firstCreditPrice)}`;
  }

  return group.trades
    .map((trade) => formatCredit(trade.creditPrice))
    .join(" / ");
}

function getTradeTitle(trade: TradeListItem) {
  return trade.talentTitle?.trim() || `거래 #${trade.tradeId}`;
}

export default function TradesPage() {
  const [selectedStatus, setSelectedStatus] = useState<TradeStatus | "">("");
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrades = useCallback(
    async ({
      cursor,
      append = false,
    }: { cursor?: number | null; append?: boolean } = {}) => {
      if (!hasStoredAccessToken()) {
        setTrades([]);
        setCurrentUserId(null);
        setHasNext(false);
        setNextCursor(null);
        setErrorMessage("로그인 후 이용해 주세요.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(getStoredUserId());

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const response = await tradeApi.getList({
          status: selectedStatus || undefined,
          cursor,
          size: PAGE_SIZE,
        });

        setTrades((current) =>
          append
            ? [...current, ...response.content]
            : response.content,
        );
        setHasNext(response.hasNext);
        setNextCursor(response.nextCursor);
      } catch (error) {
        if (!append) {
          setTrades([]);
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "거래 목록을 불러오지 못했습니다.",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedStatus],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTrades();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadTrades]);

  async function handleLoadMore() {
    if (!hasNext || nextCursor === null || isLoadingMore) {
      return;
    }

    await loadTrades({ cursor: nextCursor, append: true });
  }

  const tradeGroups = groupTradesForView(trades);

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-hidden bg-white">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#f4f0ff] blur-3xl" />

      <div className="fixed-container relative py-10 sm:py-14 lg:py-16">
        <header className="text-center">
          <h1 className="baton-page-title mt-3">
            MY TRADE
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-zinc-500 sm:mt-5 sm:text-lg sm:leading-8">
            진행 중인 교환, 검토 중인 결과물, 완료된 협업 기록을 한곳에서 확인하세요.
          </p>
        </header>

        <div className="mt-10 mb-8 flex gap-2 overflow-x-auto rounded-lg border border-[#ded6ff] bg-white/90 p-2 shadow-sm shadow-violet-950/[0.03] [scrollbar-width:none] sm:mt-14 sm:mb-10 sm:flex-wrap sm:overflow-visible">
          {statusOptions.map((option) => {
            const isActive = selectedStatus === option.value;

            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => setSelectedStatus(option.value)}
                className={`h-11 shrink-0 cursor-pointer rounded-md px-5 text-sm font-black transition ${isActive
                  ? "bg-[#8c5bff] text-white shadow-lg shadow-violet-400/20"
                  : "text-zinc-600 hover:bg-[#f4f0ff] hover:text-[#8c5bff]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {errorMessage ? (
          <div className="mb-5">
            <ErrorState message={errorMessage} />
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm font-semibold text-zinc-600">
            거래 목록을 불러오는 중입니다.
          </div>
        ) : null}

        {!isLoading && !errorMessage && trades.length === 0 ? (
          <EmptyState title="조건에 맞는 거래가 없습니다." />
        ) : null}

        {!isLoading && trades.length > 0 ? (
          <>
            <div className="grid gap-4">
              {tradeGroups.map((group) => (
                <TradeGroupCard
                  key={group.groupKey}
                  group={group}
                  currentUserId={currentUserId}
                />
              ))}
            </div>

            {hasNext ? (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  disabled={isLoadingMore}
                  onClick={handleLoadMore}
                  className="h-11 cursor-pointer rounded-lg border border-[#ded6ff] bg-white px-6 text-sm font-black text-zinc-800 transition hover:border-[#8c5bff] hover:bg-[#fbf9ff] hover:text-[#8c5bff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingMore ? "불러오는 중..." : "더 보기"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

function TradeGroupCard({
  group,
  currentUserId,
}: {
  group: TradeGroupView;
  currentUserId: number | null;
}) {
  if (group.tradeType !== "SWAP" || group.trades.length === 1) {
    return (
      <TradeListCard trade={group.trades[0]} currentUserId={currentUserId} />
    );
  }

  const groupStatus = getRepresentativeStatus(group);

  const receiveTrade = group.trades.find(
    (trade) => currentUserId !== null && trade.buyerId === currentUserId,
  );

  const provideTrade = group.trades.find(
    (trade) => currentUserId !== null && trade.sellerId === currentUserId,
  );

  return (
    <section className="overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-sm shadow-violet-950/[0.04] transition hover:-translate-y-0.5 hover:border-[#c8b7ff] hover:shadow-xl hover:shadow-violet-950/[0.08]">
      <div className="h-[3px] bg-[linear-gradient(90deg,rgba(140,91,255,0.68)_0%,rgba(120,169,255,0.48)_54%,rgba(121,228,221,0.58)_100%)]" />
      <div className="p-6">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8c5bff]">
              교환 거래
            </p>
            <p className="mt-2 text-xl font-black text-zinc-950">
              거래 #{group.trades[0].tradeGroupId ?? group.trades[0].tradeId}
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              {formatDate(group.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <TradeStatusPill status={groupStatus} />
            <TradeTypePill tradeType="SWAP" />
            <span className="inline-flex items-center rounded-full bg-[#f4f0ff] px-3 py-1.5 text-xs font-black text-[#8c5bff]">
              {formatGroupCredit(group)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-[#eee8ff] bg-[#fbf9ff] p-4 md:grid-cols-2">
          {receiveTrade ? (
            <TradeLegLink
              title="내가 받을 재능"
              description="결과물 확인, 구매 확정, 분쟁 신청을 진행합니다."
              trade={receiveTrade}
            />
          ) : null}

          {provideTrade ? (
            <TradeLegLink
              title="내가 제공할 재능"
              description="결과물을 제출하는 거래입니다."
              trade={provideTrade}
            />
          ) : null}

          {!receiveTrade && !provideTrade ? (
            <div className="rounded-md bg-white/85 p-4 text-sm font-semibold text-zinc-600 md:col-span-2">
              현재 로그인 사용자와 연결된 거래 역할을 확인하지 못했습니다.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TradeLegLink({
  title,
  description,
  trade,
}: {
  title: string;
  description: string;
  trade: TradeListItem;
}) {
  return (
    <Link
      href={`/trades/${trade.tradeId}`}
      className="rounded-md bg-white/85 p-4 transition hover:bg-white hover:shadow-sm hover:shadow-violet-950/[0.05]"
    >
      <p className="text-xs font-black text-[#8c5bff]">{title}</p>

      <p className="mt-2 text-base font-black text-zinc-950">
        {getTradeTitle(trade)}
      </p>

      <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>

      <p className="mt-3 text-sm font-bold text-zinc-700">
        {formatCredit(trade.creditPrice)}
      </p>
    </Link>
  );
}

function TradeListCard({
  trade,
  currentUserId,
}: {
  trade: TradeListItem;
  currentUserId: number | null;
}) {
  const isBuyer = currentUserId === trade.buyerId;
  const isSeller = currentUserId === trade.sellerId;

  const myRoleLabel = isBuyer
    ? "내가 구매자"
    : isSeller
      ? "내가 판매자"
      : "참여자 확인 필요";

  return (
    <Link
      href={`/trades/${trade.tradeId}`}
      className="block overflow-hidden rounded-lg border border-[#ded6ff] bg-white/95 shadow-sm shadow-violet-950/[0.04] transition hover:-translate-y-0.5 hover:border-[#c8b7ff] hover:shadow-xl hover:shadow-violet-950/[0.08]"
    >
      <div className="h-[3px] bg-[linear-gradient(90deg,rgba(140,91,255,0.68)_0%,rgba(120,169,255,0.48)_54%,rgba(121,228,221,0.58)_100%)]" />
      <div className="grid gap-5 p-6 md:grid-cols-[1fr_150px_170px] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TradeStatusPill status={trade.tradeStatus} />
            <TradeTypePill tradeType={trade.tradeType} />
          </div>

          <p className="mt-4 truncate text-xl font-black text-zinc-950">
            {getTradeTitle(trade)}
          </p>

          <p className="mt-1 text-sm font-semibold text-zinc-500">
            {myRoleLabel} · 거래 #{trade.tradeId}
          </p>
        </div>

        <div className="rounded-lg border border-[#eee8ff] bg-[#fbf9ff] px-4 py-3 text-sm font-bold text-zinc-600">
          {formatDate(trade.updatedAt)}
        </div>

        <p className="text-xl font-black text-zinc-950 md:text-right">
          {formatCredit(trade.creditPrice)}
        </p>
      </div>
    </Link>
  );
}
